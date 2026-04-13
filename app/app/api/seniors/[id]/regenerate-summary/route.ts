import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSummary, SUMMARY_FIELDS } from "@/lib/summaryGenerator";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seniorId = Number(id);

  const { data: senior, error } = await supabase
    .from("seniors")
    .select("*")
    .eq("id", seniorId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!senior) return NextResponse.json({ error: "not found" }, { status: 404 });

  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: journals } = await supabase
    .from("journals")
    .select("created_at, transcript, summary")
    .eq("senior_id", seniorId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const prevSummary: Record<string, string | null> = {};
  for (const f of SUMMARY_FIELDS) prevSummary[f.key] = (senior as any)[f.key] ?? null;

  const newSummary = await generateSummary({
    senior,
    journals: journals ?? [],
    prevSummary,
  });

  const patch = { ...newSummary, assess_updated_at: new Date().toISOString() };
  await supabase.from("seniors").update(patch).eq("id", seniorId);

  // assessments 이력 저장
  const { data: prevVer } = await supabase
    .from("assessments")
    .select("version")
    .eq("senior_id", seniorId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (prevVer?.version ?? 0) + 1;

  const { data: full } = await supabase.from("seniors").select("*").eq("id", seniorId).single();
  await supabase.from("assessments").insert({
    senior_id: seniorId,
    version,
    assessed_at: new Date().toISOString(),
    source: "ai_journal_summary",
    snapshot: full,
    notes: `최근 일지 ${journals?.length ?? 0}건 기반 자동 갱신`,
  });

  return NextResponse.json({ ok: true, version, journals_used: journals?.length ?? 0, summary: newSummary });
}
