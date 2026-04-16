import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.needs_assessment_full) return NextResponse.json({ error: "needs_assessment_full required" }, { status: 400 });
  const { error } = await supabase
    .from("seniors")
    .update({
      needs_assessment_full: body.needs_assessment_full,
      needs_assessment_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
