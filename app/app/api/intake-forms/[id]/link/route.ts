import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { suggestFallScores } from "@/lib/fallAssessor";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: intake, error } = await supabase.from("intake_forms").select("*").eq("id", id).maybeSingle();
  if (error || !intake) return NextResponse.json({ error: "초기상담기록지를 찾을 수 없음" }, { status: 404 });
  if (intake.senior_id) return NextResponse.json({ error: "이미 대상자와 연결됨", senior_id: intake.senior_id }, { status: 400 });

  const d = intake.extracted_data ?? {};
  if (!d.name) return NextResponse.json({ error: "추출된 이름이 없어 대상자 생성 불가" }, { status: 400 });

  const diseases = Array.isArray(d.diseases) ? d.diseases : [];
  const seniorRow: Record<string, any> = {
    name: d.name,
    gender: d.gender ?? null,
    birth_date: d.birth_date ?? null,
    grade: d.grade ?? null,
    education: d.education ?? null,
    blood_type: d.blood_type ?? null,
    hometown: d.hometown ?? null,
    economic_status: d.economic_status ?? null,
    height_cm: d.height_cm ?? null,
    weight_kg: d.weight_kg ?? null,
    spouse: d.spouse ?? null,
    guardian_name: d.guardian_name ?? null,
    guardian_relation: d.guardian_relation ?? null,
    guardian_phone: d.guardian_phone ?? null,
    walking_state: d.walking ?? null,
    meal_form: d.meal_form ?? null,
    vision: d.vision ?? null,
    hearing: d.hearing ?? null,
    speech: d.speech ?? null,
    medications: d.medications ?? null,
    major_diseases: diseases,
    intake_pdf_path: intake.pdf_path,
    status: "active",
  };

  const { data: senior, error: insErr } = await supabase
    .from("seniors")
    .insert(seniorRow)
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await supabase
    .from("intake_forms")
    .update({ senior_id: senior.id, status: "linked", updated_at: new Date().toISOString() })
    .eq("id", id);

  try {
    const fall = await suggestFallScores(d);
    await supabase.from("fall_assessments").insert({
      senior_id: senior.id,
      assessed_at: new Date().toISOString().slice(0, 10),
      assessor: intake.counselor_name ?? null,
      scores: fall.scores,
      total: fall.total,
      interpretation: fall.interpretation,
      notes: fall.notes,
      source: "ai_auto",
    });
  } catch (e: any) {
    console.error("Fall assessment auto-gen failed:", e.message);
  }

  return NextResponse.json({ senior });
}
