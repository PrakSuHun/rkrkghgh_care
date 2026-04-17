import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const { data, error } = await supabase
    .from("saved_documents")
    .select("*, seniors(name), caregivers(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.doc_type || !body.title) return NextResponse.json({ error: "doc_type, title 필요" }, { status: 400 });
  const { data, error } = await supabase
    .from("saved_documents")
    .insert({
      doc_type: body.doc_type,
      title: body.title,
      senior_id: body.senior_id ?? null,
      worker_id: body.worker_id ?? null,
      month: body.month ?? null,
      content: body.content ?? {},
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
