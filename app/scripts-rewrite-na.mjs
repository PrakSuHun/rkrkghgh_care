#!/usr/bin/env node
// 기존 욕구사정지의 opinion 필드를 "보호자 면담을 통해" 로 자연스럽게 다시 작성
// 사용: node rewrite-na-opinions.mjs <id1> <id2> ...

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";

// .env.local 읽기 (간단 파서)
const env = readFileSync("/Volumes/박수훈/care/app/.env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genai.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { temperature: 0.2, responseMimeType: "text/plain" },
});

const PATHS = [
  ["section2_health", "opinion"],
  ["section3_adl", "opinion"],
  ["section4_physical", "opinion"],
  ["section5_nursing", "opinion"],
  ["section6_cognition", "opinion"],
  ["section7_support", "opinion"],
  ["section8_environment", "opinion"],
  ["section9_desired", "opinion"],
  ["section10_summary", "health"],
  ["section10_summary", "function"],
  ["section10_summary", "cognition"],
  ["section10_summary", "care_plan_direction"],
];

async function rewrite(originalText, sectionHint) {
  const prompt = `당신은 재가장기요양센터의 욕구사정기록지 작성자입니다.
아래 원문 opinion/summary 텍스트를 **"보호자 면담을 통해 판단된 내용으로는"** 으로 자연스럽게 시작하는 문장으로 다시 작성하세요.

규칙:
- 반드시 "보호자 면담을 통해 판단된 내용으로는" 으로 시작.
- 그 뒤에는 원문의 사실을 자연스러운 서술로 이어가기 (판단·확인 경위가 드러나게).
- 예: "당뇨와 대장암 있으심" → "보호자 면담을 통해 판단된 내용으로는 당뇨와 대장암이 있으심."
- 예: "세심한 관찰이 필요함" → "보호자 면담을 통해 판단된 내용으로는 세심한 관찰이 필요할 것으로 사료됨."
- 원문의 핵심 사실·수치·고유명사는 100% 보존. 새로운 사실 창작 금지.
- 3문장 이내, 150자 이내.
- 한국어 존댓말 어조 유지.
- **본문만 출력**. 따옴표·설명·머리말 금지.

참고: 이 텍스트는 "${sectionHint}" 섹션의 의견/판단근거 필드입니다.

[원문]
${originalText}
`;
  const res = await model.generateContent(prompt);
  return res.response.text().trim();
}

const SECTION_LABEL = {
  section2_health: "일반적 건강상태",
  section3_adl: "일상생활 수행능력",
  section4_physical: "신체기능",
  section5_nursing: "간호처치",
  section6_cognition: "인지기능 및 의사소통",
  section7_support: "사회환경·가족지원",
  section8_environment: "주거환경",
  section9_desired: "희망하는 서비스",
  section10_summary: "종합의견",
};

async function processSenior(id) {
  const { data: row, error } = await supabase
    .from("seniors")
    .select("id, name, needs_assessment_full")
    .eq("id", id)
    .single();
  if (error || !row?.needs_assessment_full) {
    console.log(`[${id}] skip (no needs_assessment_full)`);
    return { id, skipped: true };
  }
  const naf = JSON.parse(JSON.stringify(row.needs_assessment_full));
  let changes = 0;
  for (const [section, field] of PATHS) {
    const orig = naf?.[section]?.[field];
    if (!orig || typeof orig !== "string" || orig.trim() === "") continue;
    // 기존 접두어(옛 "보호자 면담을 통해 " / 새 "보호자 면담을 통해 판단된 내용으로는 ") 모두 제거 후 원문 추출
    const cleaned = orig
      .replace(/^보호자 면담을 통해 판단된 내용으로는\s*/, "")
      .replace(/^보호자 면담을 통해\s*/, "")
      .trim();
    // 접두사만 남은 경우 재작성
    try {
      const next = await rewrite(cleaned, SECTION_LABEL[section] ?? section);
      if (next && next !== orig) {
        naf[section][field] = next;
        changes++;
      }
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      console.error(`[${id}] ${section}.${field} error:`, e.message);
    }
  }
  if (changes > 0) {
    const { error: updErr } = await supabase
      .from("seniors")
      .update({ needs_assessment_full: naf })
      .eq("id", id);
    if (updErr) {
      console.error(`[${id}] update error:`, updErr.message);
      return { id, error: updErr.message };
    }
  }
  console.log(`[${id}] ${row.name} — ${changes} fields rewritten`);
  return { id, name: row.name, changes };
}

async function main() {
  const ids = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
  if (ids.length === 0) {
    console.error("Usage: node rewrite-na-opinions.mjs <id1> <id2> ...");
    process.exit(1);
  }
  console.log(`Processing ${ids.length} seniors...`);
  const results = [];
  for (const id of ids) {
    results.push(await processSenior(id));
  }
  const total = results.reduce((s, r) => s + (r.changes ?? 0), 0);
  console.log(`\nDone. ${results.length} seniors, ${total} fields rewritten.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
