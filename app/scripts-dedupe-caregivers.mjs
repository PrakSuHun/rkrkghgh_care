#!/usr/bin/env node
// caregivers 중복 제거 — 정규화(공백/퇴사태그 제거) 기반
// - 동일 정규화 name 끼리 묶어 최소 id 유지
// - 이름에 (퇴사) 가 붙은 경우 → status=resigned 로 설정
// - counseling_logs/caregiver_assignments/saved_documents 참조 재매핑 후 삭제

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync("/Volumes/박수훈/care/app/.env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 한글 자모분리형(NFD)을 완성형(NFC)으로 통일 + 공백/퇴사태그 제거
const normalize = (s) => String(s ?? "")
  .normalize("NFC")
  .replace(/\(퇴사\)/g, "")
  .replace(/\(휴직\)/g, "")
  .replace(/\s+/g, "")
  .trim();

const { data: all } = await supabase.from("caregivers").select("id, name, status").order("id");
console.log(`총 ${all.length}명`);

const groups = new Map();
for (const c of all) {
  const k = normalize(c.name);
  if (!k) continue;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(c);
}

const dupes = [...groups.entries()].filter(([_, v]) => v.length > 1);
console.log(`중복 그룹: ${dupes.length}개`);

let totalDeleted = 0;
let totalReassigned = 0;
let totalRenamed = 0;

for (const [key, list] of dupes) {
  list.sort((a, b) => a.id - b.id);
  const keep = list[0];
  const drop = list.slice(1);
  const dropIds = drop.map((c) => c.id);
  const anyResigned = list.some((c) => /퇴사/.test(c.name) || c.status === "resigned");
  const cleanName = key;

  console.log(`[${cleanName}] keep=${keep.id} (${keep.name}), drop=${dropIds.join(",")} ${anyResigned ? "→ 퇴사 상태" : ""}`);

  // counseling_logs 이관
  const { data: cl, error: clErr } = await supabase
    .from("counseling_logs")
    .update({ caregiver_id: keep.id })
    .in("caregiver_id", dropIds)
    .select("id");
  if (clErr) { console.error("  cl update:", clErr.message); continue; }
  totalReassigned += cl?.length ?? 0;

  // caregiver_assignments 이관 — 단, (senior_id, caregiver_id, status) 유니크 제약이 있을 수 있으므로 충돌 체크
  const { data: dropAssigns } = await supabase
    .from("caregiver_assignments")
    .select("id, senior_id, caregiver_id, status")
    .in("caregiver_id", dropIds);
  for (const a of dropAssigns ?? []) {
    // keep 에 동일 (senior_id, status) 조합이 이미 있으면 이 row 는 삭제
    const { data: existing } = await supabase
      .from("caregiver_assignments")
      .select("id")
      .eq("caregiver_id", keep.id)
      .eq("senior_id", a.senior_id)
      .eq("status", a.status)
      .maybeSingle();
    if (existing) {
      await supabase.from("caregiver_assignments").delete().eq("id", a.id);
    } else {
      await supabase.from("caregiver_assignments").update({ caregiver_id: keep.id }).eq("id", a.id);
    }
  }

  // saved_documents 이관
  await supabase.from("saved_documents").update({ worker_id: keep.id }).in("worker_id", dropIds);

  // 중복 삭제
  const { error: delErr } = await supabase.from("caregivers").delete().in("id", dropIds);
  if (delErr) { console.error("  delete:", delErr.message); continue; }
  totalDeleted += dropIds.length;

  // 유지된 caregiver 의 이름을 정규화본으로, 퇴사 여부 반영
  const patch = {};
  if (keep.name !== cleanName) patch.name = cleanName;
  if (anyResigned && keep.status !== "resigned") patch.status = "resigned";
  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await supabase.from("caregivers").update(patch).eq("id", keep.id);
    if (upErr) console.error("  rename:", upErr.message);
    else totalRenamed++;
  }
}

// 중복 없이 혼자 있지만 이름에 (퇴사) 붙은 경우도 정리
const loners = all.filter((c) => /퇴사/.test(c.name) && !dupes.some(([_, l]) => l.includes(c)));
for (const c of loners) {
  const clean = normalize(c.name);
  console.log(`[lone ${c.id}] ${c.name} → ${clean} (resigned)`);
  await supabase.from("caregivers").update({ name: clean, status: "resigned" }).eq("id", c.id);
  totalRenamed++;
}

console.log(`\n완료: 중복 삭제 ${totalDeleted}건, 참조 재매핑 ${totalReassigned}건, 이름 정리 ${totalRenamed}건`);
