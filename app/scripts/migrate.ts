import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const ROOT = path.resolve(__dirname, "../..");
const RECIPIENTS_DIR = path.join(ROOT, "Autocare/Recipients");
const CAREGIVERS_DIR = path.join(ROOT, "Autocare/Caregivers");
const SCHEDULES_DIR = path.join(ROOT, "Autocare/Schedules");
const CSV_PATH = path.join(ROOT, "대상자 욕구사정 22db0f91c13a800da2ebdf0e0cd3f9b5.csv");

type SeniorRow = {
  name: string;
  long_term_care_id?: string | null;
  grade?: string | null;
  birth_date?: string | null;
  address_type?: string | null;
  major_diseases?: string[];
  physical_status?: string | null;
  mobility?: string | null;
  cognitive_memory?: string | null;
  cognitive_behavior?: string | null;
  essential_services?: string[];
  external_support?: string | null;
  service_master_pattern?: Record<string, unknown>;
  assess_meal?: string | null;
  assess_mobility?: string | null;
  assess_physical?: string | null;
  assess_excretion?: string | null;
  assess_hygiene?: string | null;
  assess_adl?: string | null;
  assess_cognition?: string | null;
  assess_behavior?: string | null;
  assess_family_env?: string | null;
  assess_summary?: string | null;
  assess_updated_at?: string | null;
};

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadRecipients(): Map<string, SeniorRow> {
  const map = new Map<string, SeniorRow>();
  const files = fs.readdirSync(RECIPIENTS_DIR).filter((f) => f.endsWith("_Card.json") && !f.startsWith("._"));
  for (const f of files) {
    const d = readJson(path.join(RECIPIENTS_DIR, f));
    const b = d.basic_info ?? {};
    const h = d.health_condition ?? {};
    const c = d.cognitive_status ?? {};
    const s = d.service_needs ?? {};
    map.set(b.name, {
      name: b.name,
      long_term_care_id: b.long_term_care_id ?? null,
      grade: b.grade ?? null,
      birth_date: /^\d{4}-\d{2}-\d{2}$/.test(b.birth_date ?? "") ? b.birth_date : null,
      address_type: b.address_type ?? null,
      major_diseases: h.major_diseases ?? [],
      physical_status: h.physical_status ?? null,
      mobility: h.mobility ?? null,
      cognitive_memory: c.memory ?? null,
      cognitive_behavior: c.behavior ?? null,
      essential_services: s.essential ?? [],
      external_support: s.external_support ?? null,
      service_master_pattern: d.service_master_pattern ?? {},
    });
  }
  return map;
}

function loadAssessmentCsv(): Map<string, Partial<SeniorRow>> {
  const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const rows: any[] = parse(raw, { columns: true, skip_empty_lines: true });
  const map = new Map<string, Partial<SeniorRow>>();
  const now = new Date().toISOString();
  for (const r of rows) {
    const name = r["이름"]?.trim();
    if (!name) continue;
    map.set(name, {
      name,
      assess_meal: r["01. 식사 및 영양상태"] ?? null,
      assess_mobility: r["02. 보행"] ?? null,
      assess_physical: r["03. 신체기능"] ?? null,
      assess_excretion: r["04. 배뇨, 배변기능"] ?? null,
      assess_hygiene: r["05. 위생 관리"] ?? null,
      assess_adl: r["06. 일상생활수행 (ADL)"] ?? null,
      assess_cognition: r["07. 인지기능"] ?? null,
      assess_behavior: r["08. 행동증상"] ?? null,
      assess_family_env: r["09. 가족 및 생활환경"] ?? null,
      assess_summary: r["10. 기타 및 종합의견"] ?? null,
      assess_updated_at: now,
    });
  }
  return map;
}

async function migrateSeniors() {
  const recips = loadRecipients();
  const assess = loadAssessmentCsv();
  const names = new Set<string>([...recips.keys(), ...assess.keys()]);
  const rows: SeniorRow[] = [];
  for (const name of names) {
    rows.push({
      ...(recips.get(name) ?? {}),
      ...(assess.get(name) ?? {}),
      name,
    });
  }
  console.log(`Upserting ${rows.length} seniors...`);
  const { error } = await sb.from("seniors").upsert(rows, { onConflict: "name" });
  if (error) throw error;

  // history_log
  for (const [name, _] of recips) {
    const card = readJson(path.join(RECIPIENTS_DIR, `${name}_Card.json`));
    const log = card.history_log ?? [];
    if (!log.length) continue;
    const { data: sen } = await sb.from("seniors").select("id").eq("name", name).single();
    if (!sen) continue;
    const histRows = log.map((e: any) => ({
      senior_id: sen.id,
      event_date: e.date,
      event: e.event,
    }));
    await sb.from("senior_history").delete().eq("senior_id", sen.id);
    await sb.from("senior_history").insert(histRows);
  }
  console.log("Seniors + history done");
}

async function migrateCaregivers() {
  const files = fs.readdirSync(CAREGIVERS_DIR).filter((f) => f.endsWith("_Card.json") && !f.startsWith("._"));
  const rows: any[] = [];
  for (const f of files) {
    const d = readJson(path.join(CAREGIVERS_DIR, f));
    const i = d.caregiver_info ?? {};
    rows.push({
      name: i.name,
      phone: i.contact ?? null,
      fixed_weekly_schedules: d.fixed_weekly_schedules ?? [],
      current_month_hours: d.performance_tracking?.current_month_hours ?? 0,
    });
  }
  console.log(`Upserting ${rows.length} caregivers...`);
  const { error } = await sb.from("caregivers").upsert(rows, { onConflict: "name" });
  if (error) throw error;
  console.log("Caregivers done");
}

async function migrateMonthlyEvents() {
  if (!fs.existsSync(SCHEDULES_DIR)) return;
  const files = fs.readdirSync(SCHEDULES_DIR).filter((f) => f.startsWith("Monthly_Log") && !f.startsWith("._"));
  const rows: any[] = [];
  for (const f of files) {
    const d = readJson(path.join(SCHEDULES_DIR, f));
    const daily = d.daily_events ?? {};
    for (const [date, events] of Object.entries(daily)) {
      for (const ev of events as any[]) {
        rows.push({
          event_date: date,
          event_type: ev.type,
          caregiver_name: ev.caregiver ?? null,
          senior_name: ev.recipient ?? null,
          payload: ev,
        });
      }
    }
  }
  if (!rows.length) return;
  console.log(`Inserting ${rows.length} monthly events...`);
  await sb.from("monthly_events").delete().neq("id", 0);
  const { error } = await sb.from("monthly_events").insert(rows);
  if (error) throw error;
  console.log("Monthly events done");
}

async function main() {
  await migrateSeniors();
  await migrateCaregivers();
  await migrateMonthlyEvents();
  console.log("All migrations complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
