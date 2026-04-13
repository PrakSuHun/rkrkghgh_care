import { NextResponse } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const path = String(body.path ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path, signedUrl: data.signedUrl, token: data.token });
}
