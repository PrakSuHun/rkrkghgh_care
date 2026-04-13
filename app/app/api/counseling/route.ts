import { NextResponse } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";
import { transcribeAndSummarize } from "@/lib/transcribe";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const { data, error } = await supabase
    .from("counseling_logs")
    .select("*, caregivers(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    worker_name: r.caregivers?.name ?? null,
  }));
  return NextResponse.json({ logs: rows, total: rows.length });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const workerId = Number(formData.get("worker_id"));
  const duration = Number(formData.get("duration") ?? 0);
  const audio = formData.get("audio") as File | null;

  if (!workerId || !audio) {
    return NextResponse.json({ error: "worker_id and audio required" }, { status: 400 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";
  const filename = `counseling_${workerId}_${Date.now()}.webm`;

  const { error: upErr } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: inserted, error: insErr } = await supabase
    .from("counseling_logs")
    .insert({ caregiver_id: workerId, audio_url: filename, duration, status: "processing" })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const logId = inserted.id;

  transcribeAndSummarize(buffer, mimeType, "counseling")
    .then(async ({ transcript, summary }) => {
      await supabase
        .from("counseling_logs")
        .update({ transcript, summary, status: "done" })
        .eq("id", logId);
    })
    .catch(async (err) => {
      console.error("Transcription failed:", err);
      await supabase
        .from("counseling_logs")
        .update({ status: "failed", transcript: `변환 실패: ${err.message}` })
        .eq("id", logId);
    });

  return NextResponse.json({ id: logId, status: "processing" });
}
