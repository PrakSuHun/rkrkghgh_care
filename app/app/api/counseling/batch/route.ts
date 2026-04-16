import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateCounselingBatch } from "@/lib/counselingGenerator";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const topic = String(body.topic ?? "").trim();
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));
  const workerIds: number[] = Array.isArray(body.worker_ids) ? body.worker_ids : [];

  if (!topic) return NextResponse.json({ error: "주제를 입력해주세요" }, { status: 400 });
  if (workerIds.length === 0) return NextResponse.json({ error: "요양보호사를 선택해주세요" }, { status: 400 });

  const { data: workers } = await supabase
    .from("caregivers")
    .select("id, name")
    .in("id", workerIds);
  if (!workers?.length) return NextResponse.json({ error: "요양보호사를 찾을 수 없음" }, { status: 404 });

  const results = await generateCounselingBatch({
    topic,
    date,
    workers: workers.map((w: any) => ({ id: w.id, name: w.name })),
  });

  const rows = results.map((r) => ({
    caregiver_id: r.workerId ?? (r as any).worker_id,
    summary: r.summary,
    topic,
    source: "ai_batch",
    status: "done",
    duration: 0,
    audio_url: "",
    created_at: new Date(`${date}T09:00:00`).toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from("counseling_logs")
    .insert(rows)
    .select("id, caregiver_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: inserted?.length ?? 0, logs: inserted });
}
