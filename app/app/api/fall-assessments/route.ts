import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { suggestFallScores } from "@/lib/fallAssessor";

export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seniorId = url.searchParams.get("senior_id");
  let q = supabase.from("fall_assessments").select("*").order("assessed_at", { ascending: false });
  if (seniorId) q = q.eq("senior_id", seniorId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assessments: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  const seniorId = Number(body.senior_id);
  if (!seniorId) return NextResponse.json({ error: "senior_id 필요" }, { status: 400 });

  const { data: senior } = await supabase.from("seniors").select("id, name, birth_date, intake_pdf_path").eq("id", seniorId).maybeSingle();
  if (!senior) return NextResponse.json({ error: "대상자 없음" }, { status: 404 });

  const { data: intake } = await supabase
    .from("intake_forms")
    .select("extracted_data, counselor_name")
    .eq("senior_id", seniorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const source = intake?.extracted_data ?? { name: senior.name, birth_date: senior.birth_date };
  const result = await suggestFallScores(source as any);
  const { data: row, error } = await supabase
    .from("fall_assessments")
    .insert({
      senior_id: seniorId,
      assessor: intake?.counselor_name ?? null,
      scores: result.scores,
      total: result.total,
      interpretation: result.interpretation,
      notes: result.notes,
      source: "ai_manual",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("saved_documents").insert({
    doc_type: "fall_assessment",
    title: `${senior.name} · ${result.interpretation}`,
    senior_id: seniorId,
    content: { fall_id: row.id, scores: result.scores, total: result.total, interpretation: result.interpretation, notes: result.notes },
  });

  return NextResponse.json({ assessment: row });
}
