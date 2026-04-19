import { NextResponse } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";
import { extractIntakeFromAudio } from "@/lib/intakeExtractor";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const audioPath = String(body.audio_path ?? "");
  const mimeType = String(body.mime_type ?? "audio/webm");
  if (!audioPath) return NextResponse.json({ error: "audio_path required" }, { status: 400 });

  const { data: file, error: dlErr } = await supabase.storage.from(AUDIO_BUCKET).download(audioPath);
  if (dlErr || !file) return NextResponse.json({ error: dlErr?.message ?? "audio not found" }, { status: 404 });
  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await extractIntakeFromAudio(buffer, mimeType);
  } catch (e: any) {
    const { data: row } = await supabase
      .from("intake_forms")
      .insert({ status: "failed", error_msg: e.message, source: "audio", audio_path: audioPath })
      .select("*")
      .single();
    return NextResponse.json({ error: e.message, intake: row }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("intake_forms")
    .insert({
      audio_path: audioPath,
      source: "audio",
      counseling_date: result.extracted.counseling_date ?? null,
      counselor_name: result.extracted.counselor_name ?? null,
      extracted_data: result.extracted,
      transcript: result.transcript,
      status: "extracted",
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ intake: inserted });
}
