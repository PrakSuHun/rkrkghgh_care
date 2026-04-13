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

  const { data: logs } = await supabase
    .from("counseling_logs")
    .select("*")
    .eq("caregiver_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ worker, logs: logs ?? [] });
}
