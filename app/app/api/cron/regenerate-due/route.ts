import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSummary, SUMMARY_FIELDS } from "@/lib/summaryGenerator";

// 매일 호출 → 오늘 갱신 예정인 어르신들만 처리하고 next_summary_at +21일
export async function POST() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from("seniors")
    .select("*")
    .eq("status", "active")
    .lte("next_summary_at", today)
    .limit(20); // 안전상 하루 최대 20명

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let ok = 0, fail = 0;
  const results: any[] = [];

  for (const senior of due ?? []) {
    try {
      const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
      const { data: journals } = await supabase
        .from("journals")
        .select("created_at, transcript, summary")
        .eq("senior_id", senior.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      const prevSummary: Record<string, string | null> = {};
      for (const f of SUMMARY_FIELDS) prevSummary[f.key] = (senior as any)[f.key] ?? null;

      const newSummary = await generateSummary({
        senior,
        journals: journals ?? [],
        prevSummary,
      });

      const next = new Date();
      next.setDate(next.getDate() + 21);
      const nextDate = next.toISOString().slice(0, 10);

      await supabase
        .from("seniors")
        .update({
          ...newSummary,
          assess_updated_at: new Date().toISOString(),
          next_summary_at: nextDate,
        })
        .eq("id", senior.id);

      // 이력
      const { data: prevVer } = await supabase
        .from("assessments")
        .select("version")
        .eq("senior_id", senior.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = (prevVer?.version ?? 0) + 1;
      const { data: full } = await supabase.from("seniors").select("*").eq("id", senior.id).single();
      await supabase.from("assessments").insert({
        senior_id: senior.id,
        version,
        assessed_at: new Date().toISOString(),
        source: "scheduled",
        snapshot: full,
        notes: `예정 갱신 (일지 ${journals?.length ?? 0}건)`,
      });

      ok++;
      results.push({ id: senior.id, name: senior.name, version, journals: journals?.length ?? 0, next: nextDate });
    } catch (e: any) {
      fail++;
      results.push({ id: senior.id, name: senior.name, error: e.message });
    }
  }

  return NextResponse.json({ ok, fail, total: due?.length ?? 0, results });
}

export async function GET() {
  // 다음 갱신 예정 미리보기
  const { data } = await supabase
    .from("seniors")
    .select("id, name, next_summary_at")
    .eq("status", "active")
    .order("next_summary_at");
  return NextResponse.json({ schedule: data });
}
