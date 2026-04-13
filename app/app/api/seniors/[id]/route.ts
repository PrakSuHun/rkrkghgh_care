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

  const { data: journals } = await supabase
    .from("journals")
    .select("*")
    .eq("senior_id", id)
    .order("created_at", { ascending: false });

  const { data: history } = await supabase
    .from("senior_history")
    .select("*")
    .eq("senior_id", id)
    .order("event_date", { ascending: false });

  // 하위 호환 필드 alias
  const compat = {
    ...senior,
    diseases: senior.major_diseases ?? [],
    service_pattern: senior.service_master_pattern ?? {},
  };

  return NextResponse.json({ senior: compat, journals: journals ?? [], history: history ?? [] });
}
