import { NextResponse, after } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";
import { transcribeAndSummarize } from "@/lib/transcribe";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25MB
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
  const status = url.searchParams.get("status");
  const limit = Number(url.searchParams.get("limit") ?? 50);

  let q = supabase
    .from("journals")
    .select("*, seniors(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    senior_name: r.seniors?.name ?? null,
  }));
  return NextResponse.json({ journals: rows, total: rows.length, data: rows });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const seniorId = Number(formData.get("senior_id"));
  const duration = Number(formData.get("duration") ?? 0);
  const audio = formData.get("audio") as File | null;

  if (!seniorId || !audio) {
    return NextResponse.json({ error: "senior_id and audio required" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio too large (max 25MB)" }, { status: 413 });
  }
  const mimeType = audio.type || "audio/webm";
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: `unsupported mime type: ${mimeType}` }, { status: 415 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const ext = mimeType.split("/")[1]?.replace("x-", "") ?? "webm";
  const filename = `journal_${seniorId}_${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: inserted, error: insErr } = await supabase
    .from("journals")
    .insert({ senior_id: seniorId, audio_url: filename, duration, status: "processing" })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const journalId = inserted.id;

  after(async () => {
    try {
      const { transcript, summary } = await transcribeAndSummarize(buffer, mimeType, "journal");
      await supabase
        .from("journals")
        .update({ transcript, summary, status: "done" })
        .eq("id", journalId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Transcription failed:", msg);
      await supabase
        .from("journals")
        .update({ status: "failed", transcript: `변환 실패: ${msg}` })
        .eq("id", journalId);
    }
  });

  return NextResponse.json({ id: journalId, status: "processing" });
}
