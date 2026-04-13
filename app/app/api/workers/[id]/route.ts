import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: worker, error } = await supabase
    .from("caregivers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [logs, assignments] = await Promise.all([
    supabase.from("counseling_logs").select("*").eq("caregiver_id", id).order("created_at", { ascending: false }),
    supabase.from("caregiver_assignments").select("*, seniors(name, grade)").eq("caregiver_id", id).order("start_date", { ascending: false }),
  ]);

  return NextResponse.json({
    worker,
    logs: logs.data ?? [],
    assignments: assignments.data ?? [],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { error } = await supabase.from("caregivers").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
