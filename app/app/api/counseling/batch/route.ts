import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateCounselingBatch } from "@/lib/counselingGenerator";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const topic = String(body.topic ?? "").trim();
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));
  const method = String(body.method ?? "대면");
  const counselor = String(body.counselor ?? "박현식");
  const workerIds: number[] = Array.isArray(body.worker_ids) ? body.worker_ids : [];
  // worker_senior_map: { [workerId]: seniorId | "none" }
  // "none" 은 "특정 어르신과 무관" 명시적 선택
  const rawMap: Record<string, any> = body.worker_senior_map ?? {};
  const workerSeniorMap = new Map<number, number | "none">();
  for (const [k, v] of Object.entries(rawMap)) {
    const wid = Number(k);
    if (!Number.isFinite(wid)) continue;
    if (v === "none" || v === null) {
      workerSeniorMap.set(wid, "none");
    } else {
      const sid = Number(v);
      if (Number.isFinite(sid)) workerSeniorMap.set(wid, sid);
    }
  }

  if (workerIds.length === 0) return NextResponse.json({ error: "요양보호사를 선택해주세요" }, { status: 400 });

  const { data: workers } = await supabase.from("caregivers").select("id, name").in("id", workerIds);
  if (!workers?.length) return NextResponse.json({ error: "요양보호사를 찾을 수 없음" }, { status: 404 });

  // 활성 배정 조회 — senior id 포함
  const { data: assigns } = await supabase
    .from("caregiver_assignments")
    .select("caregiver_id, senior_id, seniors(id, name, grade, assess_summary)")
    .in("caregiver_id", workerIds)
    .eq("status", "active");

  type SeniorLite = { id: number; name: string; grade: string | null; summary: string | null };
  const seniorsByWorker = new Map<number, SeniorLite[]>();
  for (const a of assigns ?? []) {
    const list = seniorsByWorker.get((a as any).caregiver_id) ?? [];
    const s = (a as any).seniors;
    if (s?.id) list.push({ id: s.id, name: s.name, grade: s.grade ?? null, summary: s.assess_summary ?? null });
    seniorsByWorker.set((a as any).caregiver_id, list);
  }

  // 복수 담당인데 map 에 지정이 없는 요양사 — 에러로 반환하여 UI 쪽에서 팝업 강제
  const needsPick: number[] = [];
  for (const wid of workerIds) {
    const list = seniorsByWorker.get(wid) ?? [];
    if (list.length > 1 && !workerSeniorMap.has(wid)) needsPick.push(wid);
  }
  if (needsPick.length > 0) {
    return NextResponse.json({
      error: "needs_senior_pick",
      workers_need_pick: needsPick,
      candidates: Object.fromEntries(workerIds.map((wid) => [wid, seniorsByWorker.get(wid) ?? []])),
    }, { status: 409 });
  }

  // 각 요양사에 대해 실제 연결할 senior 확정
  //   - SeniorLite: 어르신 정보 (유연결 상담)
  //   - "none": 명시적 "특정 어르신 없음"
  //   - null: 담당 어르신 자체가 0명인 기본 케이스
  type PickResult = SeniorLite | "none" | null;
  const workerSeniorChosen = new Map<number, PickResult>();
  for (const wid of workerIds) {
    const list = seniorsByWorker.get(wid) ?? [];
    const pick = workerSeniorMap.get(wid);
    if (pick === "none") {
      workerSeniorChosen.set(wid, "none");
    } else if (typeof pick === "number") {
      workerSeniorChosen.set(wid, list.find((s) => s.id === pick) ?? null);
    } else if (list.length === 1) {
      workerSeniorChosen.set(wid, list[0]);
    } else {
      workerSeniorChosen.set(wid, null);
    }
  }

  // 이전 상담 참조
  //   - 어르신 연결: 같은 (worker, senior) 짝의 최근 2건만 (섞임 방지)
  //   - 어르신 무관(none/null): 요양사의 최근 2건 전체 (일반 맥락 제공)
  const prevByWorker: Record<number, any[]> = {};
  for (const wid of workerIds) {
    const chosen = workerSeniorChosen.get(wid);
    let q = supabase
      .from("counseling_logs")
      .select("caregiver_id, senior_id, summary, topic, created_at, caregivers(name), seniors(name)")
      .eq("caregiver_id", wid)
      .order("created_at", { ascending: false })
      .limit(2);
    if (chosen && chosen !== "none") q = q.eq("senior_id", chosen.id);
    // chosen === "none" 또는 null 이면 senior 필터 없이 최근 2건
    const { data } = await q;
    prevByWorker[wid] = data ?? [];
  }

  const previousLogs = Object.values(prevByWorker).flat().map((l: any) => ({
    worker_name: l.caregivers?.name ?? "",
    senior_name: l.seniors?.name ?? null,
    summary: l.summary ?? "",
    action: l.topic ?? "",
    created_at: (l.created_at ?? "").slice(0, 10),
  }));

  const results = await generateCounselingBatch({
    topic: topic || undefined, date, method, counselor,
    workers: workers.map((w: any) => {
      const chosen = workerSeniorChosen.get(w.id);
      if (chosen && chosen !== "none") {
        return {
          id: w.id,
          name: w.name,
          seniors: [{ name: chosen.name, grade: chosen.grade, summary: chosen.summary }],
          no_senior: false,
        };
      }
      return { id: w.id, name: w.name, seniors: [], no_senior: true };
    }),
    previousLogs,
  });

  const createdAt = new Date(`${date}T09:00:00`).toISOString();
  const clRows = results.map((r) => {
    const wid = r.workerId ?? (r as any).worker_id;
    const chosen = workerSeniorChosen.get(wid);
    const sid = chosen && chosen !== "none" ? chosen.id : null;
    return {
      caregiver_id: wid,
      senior_id: sid,
      summary: r.summary,
      topic: r.action !== "해당 없음" ? r.action : null,
      source: "ai_batch",
      status: "done",
      duration: 0,
      audio_url: "",
      created_at: createdAt,
    };
  });

  const { data: inserted, error } = await supabase
    .from("counseling_logs")
    .insert(clRows)
    .select("id, caregiver_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logByWorker = new Map<number, number>();
  (inserted ?? []).forEach((l: any) => logByWorker.set(l.caregiver_id, l.id));

  const savedRows = results.map((r) => {
    const wid = r.workerId ?? (r as any).worker_id;
    const chosen = workerSeniorChosen.get(wid);
    const connected = chosen && chosen !== "none" ? chosen : null;
    const tag = connected ? ` · ${connected.name}` : (chosen === "none" ? " · 일반상담" : "");
    return {
      doc_type: "counseling",
      title: `${r.workerName ?? (r as any).worker_name ?? ""} · ${date}${tag}`,
      worker_id: wid,
      senior_id: connected?.id ?? null,
      content: {
        counselor,
        method,
        date,
        worker_name: r.workerName ?? (r as any).worker_name,
        senior_id: connected?.id ?? null,
        senior_name: connected?.name ?? null,
        no_senior: !connected,
        summary: r.summary,
        action: r.action ?? "해당 없음",
        prev_result: r.prevResult ?? "해당 없음",
        counseling_log_id: logByWorker.get(wid) ?? null,
      },
    };
  });
  await supabase.from("saved_documents").insert(savedRows);

  return NextResponse.json({ count: inserted?.length ?? 0, logs: inserted });
}
