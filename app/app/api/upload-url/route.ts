import { NextResponse } from "next/server";
import { supabase, AUDIO_BUCKET, INTAKE_BUCKET } from "@/lib/supabase";

const BUCKETS: Record<string, string> = {
  audio: AUDIO_BUCKET,
  intake: INTAKE_BUCKET,
};

export async function POST(req: Request) {
  const body = await req.json();
  const path = String(body.path ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const bucketKey = String(body.bucket ?? "audio");
  const bucket = BUCKETS[bucketKey] ?? AUDIO_BUCKET;
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path, bucket, signedUrl: data.signedUrl, token: data.token });
}
