import { NextResponse } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: row } = await supabase
    .from("journals")
    .select("audio_url")
    .eq("id", id)
    .single();
  if (row?.audio_url) {
    await supabase.storage.from(AUDIO_BUCKET).remove([row.audio_url]);
  }
  const { error } = await supabase.from("journals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
