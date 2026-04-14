import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: attendees }, { data: senior }, { data: fromW }, { data: toW }] = await Promise.all([
    data.attendee_worker_ids?.length
      ? supabase.from("caregivers").select("id, name").in("id", data.attendee_worker_ids)
      : Promise.resolve({ data: [] }),
    data.related_senior_id
      ? supabase.from("seniors").select("id, name, grade").eq("id", data.related_senior_id).maybeSingle()
      : Promise.resolve({ data: null }),
    data.related_from_worker_id
      ? supabase.from("caregivers").select("id, name").eq("id", data.related_from_worker_id).maybeSingle()
      : Promise.resolve({ data: null }),
    data.related_to_worker_id
      ? supabase.from("caregivers").select("id, name").eq("id", data.related_to_worker_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({ meeting: data, attendees: attendees ?? [], senior, fromWorker: fromW, toWorker: toW });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { error } = await supabase
    .from("meetings")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
