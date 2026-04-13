import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CG_DIR = path.resolve(__dirname, "../../Autocare/Caregivers");

async function main() {
  const files = fs.readdirSync(CG_DIR).filter(f => f.endsWith("_Card.json") && !f.startsWith("._"));
  console.log(`Caregiver files: ${files.length}`);

  // 기존 active 배정 전부 지우고 다시 시드 (중복 방지)
  await sb.from("caregiver_assignments").delete().eq("status", "active");

  const { data: allSeniors } = await sb.from("seniors").select("id, name");
  const { data: allCaregivers } = await sb.from("caregivers").select("id, name");
  const seniorMap = new Map(allSeniors?.map(s => [s.name, s.id]));
  const cgMap = new Map(allCaregivers?.map(c => [c.name, c.id]));

  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, skipped = 0;

  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(CG_DIR, f), "utf8"));
    const cgName = d.caregiver_info?.name;
    const cgId = cgMap.get(cgName);
    if (!cgId) { skipped++; continue; }

    const schedules = d.fixed_weekly_schedules ?? [];
    const seniorsSeen = new Set<number>();
    for (const s of schedules) {
      const seniorId = seniorMap.get(s.recipient_name);
      if (!seniorId || seniorsSeen.has(seniorId)) continue;
      seniorsSeen.add(seniorId);

      await sb.from("caregiver_assignments").insert({
        senior_id: seniorId,
        caregiver_id: cgId,
        role: "primary",
        start_date: today,
        weekly_pattern: s.weekly_details ?? [],
        status: "active",
      });
      inserted++;
    }
  }
  console.log(`Inserted: ${inserted}, skipped(no cg match): ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
