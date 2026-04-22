#!/usr/bin/env node
// counseling_logs 중 saved_documents (doc_type=counseling, content.counseling_log_id=<id>) 가 없는 것에 대해 생성
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("/Volumes/박수훈/care/app/.env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: logs, error: lErr } = await supabase
  .from("counseling_logs")
  .select("id, caregiver_id, summary, topic, source, created_at, caregivers(name)");
if (lErr) { console.error(lErr); process.exit(1); }
console.log(`총 상담일지: ${logs.length}건`);

const { data: savedDocs } = await supabase
  .from("saved_documents")
  .select("content")
  .eq("doc_type", "counseling");
const existingLogIds = new Set();
for (const d of savedDocs ?? []) {
  const lid = d?.content?.counseling_log_id;
  if (lid != null) existingLogIds.add(Number(lid));
}
console.log(`기존 saved_documents 커버: ${existingLogIds.size}건`);

const toCreate = logs.filter((l) => !existingLogIds.has(l.id));
console.log(`생성 대상: ${toCreate.length}건`);

const rows = toCreate.map((l) => {
  const name = l.caregivers?.name ?? "";
  const date = (l.created_at ?? "").slice(0, 10);
  return {
    doc_type: "counseling",
    title: `${name} · ${date}`,
    worker_id: l.caregiver_id,
    created_at: l.created_at,
    content: {
      counselor: "박현식",
      method: "대면",
      date,
      worker_name: name,
      summary: l.summary ?? "",
      action: l.topic ?? "해당 없음",
      prev_result: "해당 없음",
      counseling_log_id: l.id,
    },
  };
});

if (rows.length === 0) {
  console.log("생성할 것 없음");
  process.exit(0);
}

const BATCH = 100;
let total = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from("saved_documents").insert(rows.slice(i, i + BATCH));
  if (error) { console.error(`batch ${i} error:`, error.message); continue; }
  total += Math.min(BATCH, rows.length - i);
}
console.log(`→ ${total}건 saved_documents 생성 완료`);
