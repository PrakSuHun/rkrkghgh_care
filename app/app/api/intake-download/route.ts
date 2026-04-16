import { NextResponse } from "next/server";
import { supabase, INTAKE_BUCKET } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  const { data, error } = await supabase.storage.from(INTAKE_BUCKET).createSignedUrl(path, 300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
