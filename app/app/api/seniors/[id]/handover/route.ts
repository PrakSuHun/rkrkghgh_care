import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("seniors")
    .select("handover_data")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handover_data: data?.handover_data ?? null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.handover_data || typeof body.handover_data !== "object") {
    return NextResponse.json({ error: "handover_data required" }, { status: 400 });
  }

  // 1) 기록지 본문 저장
  const { data: seniorRow, error: updErr } = await supabase
    .from("seniors")
    .update({
      handover_data: body.handover_data,
      handover_updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("name")
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // 1-1) saved_documents 에도 upsert (서류 탭 목록에 노출되도록)
  const seniorName = seniorRow?.name ?? "";
  const recipientName = body.handover_data?.recipient_name ?? seniorName;
  const handoverDate = body.handover_data?.handover_date ?? new Date().toISOString().slice(0, 10);
  const monthStr = /^\d{4}-\d{2}/.test(handoverDate) ? handoverDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const title = `인수인계서 - ${recipientName || seniorName || `대상자 ${id}`}`;
  const toWorkerNum = body.handover_data?.to_worker_id ?? body.to_worker_id ?? null;
  const workerIdForDoc = toWorkerNum && Number.isFinite(Number(toWorkerNum)) ? Number(toWorkerNum) : null;

  // 기존 레코드가 있으면 update, 없으면 insert
  const { data: existing, error: lookupErr } = await supabase
    .from("saved_documents")
    .select("id")
    .eq("doc_type", "senior_handover")
    .eq("senior_id", Number(id))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupErr) console.error("[handover] saved_documents lookup error", lookupErr);

  if (existing?.id) {
    const { error: updDocErr } = await supabase
      .from("saved_documents")
      .update({
        title,
        worker_id: workerIdForDoc,
        content: body.handover_data,
        month: monthStr,
      })
      .eq("id", existing.id);
    if (updDocErr) console.error("[handover] saved_documents update error", updDocErr);
  } else {
    const { error: insDocErr } = await supabase
      .from("saved_documents")
      .insert({
        doc_type: "senior_handover",
        title,
        senior_id: Number(id),
        worker_id: workerIdForDoc,
        month: monthStr,
        content: body.handover_data,
      });
    if (insDocErr) console.error("[handover] saved_documents insert error", insDocErr);
  }

  // 2) 인계자→인수자 자동 재배정
  //    - to_worker_id 가 지정돼 있으면 기존 active 주담당 모두 종료 + 인수자 신규 배정
  let reassignment: any = null;
  const toIdRaw = body.handover_data?.to_worker_id ?? body.to_worker_id ?? null;
  const fromIdRaw = body.handover_data?.from_worker_id ?? body.from_worker_id ?? null;
  const toId = toIdRaw != null && Number.isFinite(Number(toIdRaw)) ? Number(toIdRaw) : null;
  const fromId = fromIdRaw != null && Number.isFinite(Number(fromIdRaw)) ? Number(fromIdRaw) : null;

  if (toId !== null) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: actives, error: actErr } = await supabase
      .from("caregiver_assignments")
      .select("id, caregiver_id, role, status")
      .eq("senior_id", Number(id))
      .eq("status", "active");
    if (actErr) {
      console.error("[handover] caregiver_assignments fetch error", actErr);
      return NextResponse.json({ error: `배정 조회 실패: ${actErr.message}` }, { status: 500 });
    }
    const list = actives ?? [];
    const alreadyAssigned = list.some((a: any) => Number(a.caregiver_id) === toId);

    // 인수자가 아닌 기존 active 배정은 모두 종료 (전임이 다른 사람이어도 전체 정리)
    const endedIds: number[] = [];
    for (const a of list) {
      if (Number(a.caregiver_id) === toId) continue;
      const { error: endErr } = await supabase
        .from("caregiver_assignments")
        .update({ status: "ended", end_date: today })
        .eq("id", a.id);
      if (endErr) {
        console.error("[handover] end assignment error", endErr);
        return NextResponse.json({ error: `기존 배정 종료 실패: ${endErr.message}` }, { status: 500 });
      }
      endedIds.push(a.id);
    }

    let createdId: number | null = null;
    if (!alreadyAssigned) {
      const { data: created, error: insErr } = await supabase
        .from("caregiver_assignments")
        .insert({
          senior_id: Number(id),
          caregiver_id: toId,
          role: "주담당",
          start_date: today,
          status: "active",
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("[handover] insert assignment error", insErr);
        return NextResponse.json({ error: `신규 배정 실패: ${insErr.message}` }, { status: 500 });
      }
      createdId = created?.id ?? null;
    }

    reassignment = {
      ended_assignment_ids: endedIds,
      created_assignment_id: createdId,
      from_worker_id: fromId,
      to_worker_id: toId,
      already_assigned: alreadyAssigned,
      effective_date: today,
    };
  }

  return NextResponse.json({ ok: true, reassignment });
}
