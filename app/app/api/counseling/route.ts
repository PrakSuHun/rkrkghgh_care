import { NextResponse, after } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";
import { transcribeAndSummarize } from "@/lib/transcribe";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);

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
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio too large (max 25MB)" }, { status: 413 });
  }
  const mimeType = (audio.type || "audio/webm").split(";")[0].trim();
  const baseMime = mimeType.toLowerCase();
  if (!baseMime.startsWith("audio/")) {
    return NextResponse.json({ error: `unsupported mime type: ${audio.type}` }, { status: 415 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const ext = baseMime.split("/")[1]?.replace("x-", "").replace(/[^a-z0-9]/g, "") || "webm";
  const filename = `counseling_${workerId}_${Date.now()}.${ext}`;

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

  const [{ data: allSeniors }, { data: allCaregivers }] = await Promise.all([
    supabase.from("seniors").select("name").eq("status", "active"),
    supabase.from("caregivers").select("name").eq("status", "active"),
  ]);
  const { data: assigned } = await supabase
    .from("caregiver_assignments")
    .select("seniors(name)")
    .eq("caregiver_id", workerId)
    .eq("status", "active");
  const { data: thisWorker } = await supabase
    .from("caregivers")
    .select("name")
    .eq("id", workerId)
    .single();
  const knownNames = [
    ...(allSeniors ?? []).map((r: any) => r.name),
    ...(allCaregivers ?? []).map((r: any) => r.name),
  ];
  const preferredNames = [
    ...(thisWorker ? [thisWorker.name] : []),
    ...(assigned ?? []).map((a: any) => a.seniors?.name).filter(Boolean),
  ];

  after(async () => {
    try {
      const { transcript, summary } = await transcribeAndSummarize(buffer, mimeType, "counseling", {
        knownNames,
        preferredNames,
      });
      await supabase
        .from("counseling_logs")
        .update({ transcript, summary, status: "done" })
        .eq("id", logId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Transcription failed:", msg);
      await supabase
        .from("counseling_logs")
        .update({ status: "failed", transcript: `변환 실패: ${msg}` })
        .eq("id", logId);
    }
  });

  return NextResponse.json({ id: logId, status: "processing" });
}
