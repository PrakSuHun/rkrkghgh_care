import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { interpret } from "@/lib/fallAssessor";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase.from("fall_assessments").select("*, seniors(name, birth_date)").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ assessment: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const patch: any = { updated_at: new Date().toISOString() };
  if (body.scores) {
    patch.scores = body.scores;
    patch.total = Object.values(body.scores as Record<string, number>).reduce((s, v) => s + Number(v || 0), 0);
    patch.interpretation = interpret(patch.total);
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.assessor !== undefined) patch.assessor = body.assessor;
  if (body.assessed_at !== undefined) patch.assessed_at = body.assessed_at;
  const { error } = await supabase.from("fall_assessments").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from("fall_assessments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
