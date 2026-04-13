import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: senior, error } = await supabase
    .from("seniors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!senior) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [journals, history, assignments] = await Promise.all([
    supabase.from("journals").select("*").eq("senior_id", id).order("created_at", { ascending: false }),
    supabase.from("senior_history").select("*").eq("senior_id", id).order("event_date", { ascending: false }),
    supabase.from("caregiver_assignments").select("*, caregivers(name, phone)").eq("senior_id", id).order("start_date", { ascending: false }),
  ]);

  const compat = {
    ...senior,
    diseases: senior.major_diseases ?? [],
    service_pattern: senior.service_master_pattern ?? {},
  };

  return NextResponse.json({
    senior: compat,
    journals: journals.data ?? [],
    history: history.data ?? [],
    assignments: assignments.data ?? [],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { error } = await supabase.from("seniors").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
