#!/usr/bin/env node
// /tmp/counseling_import.json 을 읽어서:
// 1) 누락된 요양보호사는 caregivers 에 추가
// 2) 상담 세션을 counseling_logs 에 삽입
// - 이미 동일 (caregiver_id, created_at, summary) 있으면 건너뜀

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("/Volumes/박수훈/care/app/.env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const data = JSON.parse(readFileSync("/tmp/counseling_import.json", "utf8"));

// 1) 기존 요양사 조회
const { data: existing, error: exErr } = await supabase
  .from("caregivers")
  .select("id, name");
if (exErr) { console.error("caregivers fetch error:", exErr); process.exit(1); }

const nameToId = new Map();
for (const c of existing) nameToId.set(c.name, c.id);
console.log(`기존 요양사 ${existing.length}명`);

// 2) 누락 요양사 추가
const missingWorkers = [];
for (const w of data) {
  if (!nameToId.has(w.worker)) missingWorkers.push(w.worker);
}
console.log(`추가 필요: ${missingWorkers.length}명 → ${missingWorkers.join(", ")}`);

if (missingWorkers.length > 0) {
  const insertRows = missingWorkers.map((name) => ({ name, status: "active" }));
  const { data: inserted, error: insErr } = await supabase
    .from("caregivers")
    .insert(insertRows)
    .select("id, name");
  if (insErr) { console.error("caregivers insert error:", insErr); process.exit(1); }
  for (const c of inserted) nameToId.set(c.name, c.id);
  console.log(`→ ${inserted.length}명 추가 완료`);
}

// 3) 상담 로그 삽입 (중복 방지: 같은 caregiver_id + created_at + summary 앞 80자)
const { data: existingLogs } = await supabase
  .from("counseling_logs")
  .select("caregiver_id, created_at, summary");
const existingKeys = new Set(
  (existingLogs ?? []).map((l) => `${l.caregiver_id}|${(l.created_at ?? "").slice(0, 10)}|${(l.summary ?? "").slice(0, 80)}`)
);

const logRows = [];
let dupCount = 0;
for (const w of data) {
  const wId = nameToId.get(w.worker);
  if (!wId) continue;
  for (const s of w.sessions) {
    const createdAt = new Date(`${s.date}T09:00:00+09:00`).toISOString();
    const key = `${wId}|${s.date}|${(s.summary ?? "").slice(0, 80)}`;
    if (existingKeys.has(key)) { dupCount++; continue; }
    existingKeys.add(key);
    logRows.push({
      caregiver_id: wId,
      summary: s.summary,
      topic: s.action || null,
      source: "xlsx_import",
      status: "done",
      duration: 0,
      audio_url: "",
      created_at: createdAt,
    });
  }
}

console.log(`삽입 대상: ${logRows.length}건 (중복 ${dupCount}건 건너뜀)`);

if (logRows.length > 0) {
  // 배치로 나눠 삽입
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < logRows.length; i += BATCH) {
    const slice = logRows.slice(i, i + BATCH);
    const { error } = await supabase.from("counseling_logs").insert(slice);
    if (error) {
      console.error(`batch ${i} error:`, error.message);
      continue;
    }
    total += slice.length;
  }
  console.log(`→ ${total}건 삽입 완료`);
}

console.log("\nDone.");
