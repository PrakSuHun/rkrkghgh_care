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
  const title = `인수인계서 - ${recipientName || seniorName}`;
  const toWorkerNum = body.handover_data?.to_worker_id ?? body.to_worker_id ?? null;

  // 기존 레코드가 있으면 update, 없으면 insert
  const { data: existing } = await supabase
    .from("saved_documents")
    .select("id")
    .eq("doc_type", "senior_handover")
    .eq("senior_id", Number(id))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("saved_documents")
      .update({
        title,
        worker_id: toWorkerNum ? Number(toWorkerNum) : null,
        content: body.handover_data,
        month: handoverDate.slice(0, 7),
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("saved_documents")
      .insert({
        doc_type: "senior_handover",
        title,
        senior_id: Number(id),
        worker_id: toWorkerNum ? Number(toWorkerNum) : null,
        month: handoverDate.slice(0, 7),
        content: body.handover_data,
      });
  }

  // 2) 인계자→인수자 자동 재배정
  //    - reassign === true 이고 from_worker_id, to_worker_id 가 모두 있고 서로 다를 때만 동작
  //    - 현재 active 인 caregiver_assignments 중 from_worker_id 와 일치하는 건만 종료
  //    - 이미 to_worker_id 로 active 배정이 있으면 새로 만들지 않음
  let reassignment: any = null;
  const fromId = body.handover_data.from_worker_id ?? body.from_worker_id ?? null;
  const toId = body.handover_data.to_worker_id ?? body.to_worker_id ?? null;
  // to_worker_id 가 지정돼 있으면 무조건 재배정 시도 (명시적 reassign 플래그 없어도)
  const reassign = body.reassign !== false && toId != null;

  if (reassign && toId && Number.isFinite(Number(toId))) {
    const today = new Date().toISOString().slice(0, 10);
    // 기존 active 배정 조회
    const { data: actives, error: actErr } = await supabase
      .from("caregiver_assignments")
      .select("id, caregiver_id, role, status")
      .eq("senior_id", id)
      .eq("status", "active");
    if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });

    const list = actives ?? [];
    let endedIds: number[] = [];
    let createdId: number | null = null;
    let skippedReason: string | null = null;

    // 인수자가 이미 active 로 배정돼 있는지 확인
    const alreadyAssigned = list.some((a: any) => Number(a.caregiver_id) === Number(toId));

    // 종료 대상: from_worker_id 와 일치하는 active 배정만 종료
    if (fromId && Number.isFinite(Number(fromId))) {
      const targets = list.filter((a: any) => Number(a.caregiver_id) === Number(fromId));
      for (const t of targets) {
        const { error: endErr } = await supabase
          .from("caregiver_assignments")
          .update({ status: "ended", end_date: today })
          .eq("id", t.id);
        if (endErr) return NextResponse.json({ error: endErr.message }, { status: 500 });
        endedIds.push(t.id);
      }
    }

    if (!alreadyAssigned) {
      const { data: created, error: insErr } = await supabase
        .from("caregiver_assignments")
        .insert({
          senior_id: Number(id),
          caregiver_id: Number(toId),
          role: "주담당",
          start_date: today,
          status: "active",
        })
        .select("id")
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      createdId = created?.id ?? null;
    } else {
      skippedReason = "인수자가 이미 활성 배정 상태입니다.";
    }

    reassignment = {
      ended_assignment_ids: endedIds,
      created_assignment_id: createdId,
      from_worker_id: fromId ?? null,
      to_worker_id: Number(toId),
      skipped: !!skippedReason,
      skipped_reason: skippedReason,
      effective_date: today,
    };
  }

  return NextResponse.json({ ok: true, reassignment });
}
