import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { generateSummary, SUMMARY_FIELDS } from "../lib/summaryGenerator";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CONCURRENCY = 8;

async function processSenior(senior: any, idx: number, total: number) {
  const name = senior.name;
  try {
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const { data: journals } = await sb
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

    const patch = { ...newSummary, assess_updated_at: new Date().toISOString() };
    await sb.from("seniors").update(patch).eq("id", senior.id);

    // 이력 기록
    const { data: prevVer } = await sb
      .from("assessments")
      .select("version")
      .eq("senior_id", senior.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (prevVer?.version ?? 0) + 1;
    const { data: full } = await sb.from("seniors").select("*").eq("id", senior.id).single();
    await sb.from("assessments").insert({
      senior_id: senior.id,
      version,
      assessed_at: new Date().toISOString(),
      source: "batch_regenerate",
      snapshot: full,
      notes: `일괄 갱신 (일지 ${journals?.length ?? 0}건 반영)`,
    });

    console.log(`[${idx}/${total}] ${name} OK (v${version}, 일지 ${journals?.length ?? 0}건)`);
    return true;
  } catch (e: any) {
    console.log(`[${idx}/${total}] ${name} FAILED: ${e.message}`);
    return false;
  }
}

async function main() {
  const { data: seniors, error } = await sb
    .from("seniors")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  console.log(`Active seniors: ${seniors?.length}`);

  let ok = 0, fail = 0;
  let next = 0;
  const total = seniors!.length;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      const success = await processSenior(seniors![i], i + 1, total);
      if (success) ok++; else fail++;
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\nDone. ok=${ok}, failed=${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
