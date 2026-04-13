import { NextResponse, after } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";
import { transcribeAndSummarize } from "@/lib/transcribe";

export const maxDuration = 300;

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
  const ct = req.headers.get("content-type") ?? "";
  let seniorId = 0;
  let duration = 0;
  let mimeType = "audio/webm";
  let buffer: Buffer | null = null;
  let filename = "";

  if (ct.includes("application/json")) {
    // 직접 업로드 모드: 클라이언트가 이미 Storage에 올린 경로 전달
    const body = await req.json();
    seniorId = Number(body.senior_id);
    duration = Number(body.duration ?? 0);
    filename = String(body.audio_path ?? "");
    mimeType = (String(body.mime_type ?? "audio/webm")).split(";")[0].trim().toLowerCase();
    if (!seniorId || !filename) {
      return NextResponse.json({ error: "senior_id and audio_path required" }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ error: `unsupported mime type: ${mimeType}` }, { status: 415 });
    }
    const { data, error } = await supabase.storage.from(AUDIO_BUCKET).download(filename);
    if (error || !data) return NextResponse.json({ error: error?.message ?? "audio not found" }, { status: 404 });
    buffer = Buffer.from(await data.arrayBuffer());
  } else {
    const formData = await req.formData();
    seniorId = Number(formData.get("senior_id"));
    duration = Number(formData.get("duration") ?? 0);
    const audio = formData.get("audio") as File | null;

    if (!seniorId || !audio) {
      return NextResponse.json({ error: "senior_id and audio required" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "audio too large (max 25MB)" }, { status: 413 });
    }
    mimeType = (audio.type || "audio/webm").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ error: `unsupported mime type: ${audio.type}` }, { status: 415 });
    }

    buffer = Buffer.from(await audio.arrayBuffer());
    const ext = mimeType.split("/")[1]?.replace("x-", "").replace(/[^a-z0-9]/g, "") || "webm";
    filename = `journal_${seniorId}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filename, buffer, { contentType: mimeType, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("journals")
    .insert({ senior_id: seniorId, audio_url: filename, duration, status: "processing" })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const journalId = inserted.id;

  // 이름 교정용 컨텍스트
  const [{ data: allSeniors }, { data: allCaregivers }] = await Promise.all([
    supabase.from("seniors").select("name").eq("status", "active"),
    supabase.from("caregivers").select("name").eq("status", "active"),
  ]);
  const { data: assigned } = await supabase
    .from("caregiver_assignments")
    .select("caregivers(name)")
    .eq("senior_id", seniorId)
    .eq("status", "active");
  const { data: thisSenior } = await supabase
    .from("seniors")
    .select("name")
    .eq("id", seniorId)
    .single();
  const knownNames = Array.from(new Set([
    ...(allSeniors ?? []).map((r: any) => r.name),
    ...(allCaregivers ?? []).map((r: any) => r.name),
  ]));
  const preferredNames = Array.from(new Set([
    ...(thisSenior ? [thisSenior.name] : []),
    ...(assigned ?? []).map((a: any) => a.caregivers?.name).filter(Boolean),
  ]));

  const audioBuf = buffer!;
  after(async () => {
    try {
      const { transcript, summary } = await transcribeAndSummarize(audioBuf, mimeType, "journal", {
        knownNames,
        preferredNames,
      });
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
