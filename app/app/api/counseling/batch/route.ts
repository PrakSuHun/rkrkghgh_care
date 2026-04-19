import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateCounselingBatch } from "@/lib/counselingGenerator";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const topic = String(body.topic ?? "").trim();
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));
  const method = String(body.method ?? "대면");
  const counselor = String(body.counselor ?? "권오성");
  const workerIds: number[] = Array.isArray(body.worker_ids) ? body.worker_ids : [];

  if (workerIds.length === 0) return NextResponse.json({ error: "요양보호사를 선택해주세요" }, { status: 400 });

  const { data: workers } = await supabase.from("caregivers").select("id, name").in("id", workerIds);
  if (!workers?.length) return NextResponse.json({ error: "요양보호사를 찾을 수 없음" }, { status: 404 });

  const { data: assigns } = await supabase
    .from("caregiver_assignments")
    .select("caregiver_id, seniors(name, grade, assess_summary)")
    .in("caregiver_id", workerIds)
    .eq("status", "active");

  const seniorsByWorker = new Map<number, Array<{ name: string; grade: string | null; summary: string | null }>>();
  for (const a of assigns ?? []) {
    const list = seniorsByWorker.get(a.caregiver_id) ?? [];
    if ((a as any).seniors?.name) list.push({
      name: (a as any).seniors.name,
      grade: (a as any).seniors.grade ?? null,
      summary: (a as any).seniors.assess_summary ?? null,
    });
    seniorsByWorker.set(a.caregiver_id, list);
  }

  const { data: prevLogs } = await supabase
    .from("counseling_logs")
    .select("caregiver_id, summary, created_at, caregivers(name)")
    .in("caregiver_id", workerIds)
    .order("created_at", { ascending: false })
    .limit(workerIds.length * 2);

  const previousLogs = (prevLogs ?? []).map((l: any) => ({
    worker_name: l.caregivers?.name ?? "",
    summary: l.summary ?? "",
    action: l.topic ?? "",
    created_at: (l.created_at ?? "").slice(0, 10),
  }));

  const results = await generateCounselingBatch({
    topic: topic || undefined, date, method, counselor,
    workers: workers.map((w: any) => ({
      id: w.id,
      name: w.name,
      seniors: seniorsByWorker.get(w.id) ?? [],
    })),
    previousLogs,
  });

  const createdAt = new Date(`${date}T09:00:00`).toISOString();
  const clRows = results.map((r) => ({
    caregiver_id: r.workerId ?? (r as any).worker_id,
    summary: r.summary,
    topic: r.action !== "해당 없음" ? r.action : null,
    source: "ai_batch",
    status: "done",
    duration: 0,
    audio_url: "",
    created_at: createdAt,
  }));

  const { data: inserted, error } = await supabase
    .from("counseling_logs")
    .insert(clRows)
    .select("id, caregiver_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logByWorker = new Map<number, number>();
  (inserted ?? []).forEach((l: any) => logByWorker.set(l.caregiver_id, l.id));

  const savedRows = results.map((r) => {
    const wid = r.workerId ?? (r as any).worker_id;
    return {
      doc_type: "counseling",
      title: `${r.workerName ?? (r as any).worker_name ?? ""} · ${date}`,
      worker_id: wid,
      content: {
        counselor,
        method,
        date,
        worker_name: r.workerName ?? (r as any).worker_name,
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
