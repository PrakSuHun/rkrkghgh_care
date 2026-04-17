import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase.from("saved_documents").select("*, seniors(name), caregivers(name)").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { error } = await supabase.from("saved_documents").update({ content: body.content }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: row } = await supabase.from("saved_documents").select("doc_type, content").eq("id", id).maybeSingle();
  const logId = row?.doc_type === "counseling" ? row?.content?.counseling_log_id : null;
  const { error } = await supabase.from("saved_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (logId) await supabase.from("counseling_logs").delete().eq("id", logId);
  return NextResponse.json({ ok: true });
}
