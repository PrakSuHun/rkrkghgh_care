import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateNeedsAssessmentFull } from "@/lib/needsAssessmentFull";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: senior, error } = await supabase.from("seniors").select("*").eq("id", id).maybeSingle();
  if (error || !senior) return NextResponse.json({ error: "대상자 없음" }, { status: 404 });

  const [{ data: intake }, { data: journals }, { data: assignments }] = await Promise.all([
    supabase.from("intake_forms").select("extracted_data").eq("senior_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("journals").select("created_at, summary").eq("senior_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("caregiver_assignments").select("caregivers(name)").eq("senior_id", id).eq("status", "active"),
  ]);
  const cgNames = (assignments ?? []).map((a: any) => a.caregivers?.name).filter(Boolean);

  try {
    const data = await generateNeedsAssessmentFull({
      senior,
      intake: intake?.extracted_data,
      journals: journals ?? [],
      caregivers: cgNames,
    });

    await supabase
      .from("seniors")
      .update({ needs_assessment_full: data, needs_assessment_updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("Needs assessment generation failed:", e.message);
    return NextResponse.json({ error: e.message ?? "생성 실패" }, { status: 500 });
  }
}
