import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

const PDF_DIR = path.resolve(__dirname, "../../Autocare/대상자");

const EXTRACT_PROMPT = `이 PDF는 장기요양 욕구조사기록지입니다. 다음 필드를 JSON으로 정확히 추출하세요.
⚠️ 절대 PDF에 명시된 내용만 추출하세요. 추측·보완·일반화 금지.
값이 명시되지 않았으면 null 또는 빈 배열로 두세요. 체크박스는 체크된 항목만 추출하세요.

출력 스키마 (JSON만 출력, 설명 금지):
{
  "basic": {
    "name": string,
    "birth_date": "YYYY-MM-DD" | null,
    "gender": "남" | "여" | null,
    "long_term_care_id": string | null,
    "grade": string | null,
    "agency_name": string | null,
    "assessed_at": "YYYY-MM-DD" | null,
    "assessor_name": string | null,
    "survey_type": "최초" | "정기" | "상태변화" | "기타" | null
  },
  "health": {
    "height_cm": number | null,
    "weight_kg": number | null,
    "bmi": number | null,
    "diseases": string[],
    "cancer": string | null,
    "medications": string | null,
    "oral_state": string | null,
    "meal_form": string | null,
    "therapy_diet": string | null,
    "nutrition_state": string | null,
    "opinion": string | null
  },
  "adl": {
    "washing_face": 0|1|2|3|null,
    "brushing_teeth": 0|1|2|3|null,
    "toileting": 0|1|2|3|null,
    "bathing": 0|1|2|3|null,
    "dressing": 0|1|2|3|null,
    "eating": 0|1|2|3|null,
    "swallowing": 0|1|2|3|null,
    "cleaning": 0|1|2|3|null,
    "meal_prep": 0|1|2|3|null,
    "laundry": 0|1|2|3|null,
    "transport": 0|1|2|3|null,
    "medication": 0|1|2|3|null,
    "shopping": 0|1|2|3|null,
    "urination": string | null,
    "urination_method": string | null,
    "defecation": string | null,
    "defecation_method": string | null,
    "opinion": string | null
  },
  "physical": {
    "joint_contracture": boolean,
    "motor_disorder": boolean,
    "paralysis": boolean,
    "amputation": boolean,
    "walking_state": string | null,
    "assistive_device": string[],
    "falls_3mo": number | null,
    "rolling": 0|1|2|3|null,
    "sitting_up": 0|1|2|3|null,
    "standing_up": 0|1|2|3|null,
    "indoor_walking": 0|1|2|3|null,
    "opinion": string | null
  },
  "nursing": {
    "respiratory": string | null,
    "skin": string | null,
    "digestive": string | null,
    "pain": string | null,
    "urinary": string | null,
    "bowel": string | null,
    "endocrine": string | null,
    "opinion": string | null
  },
  "cognition": {
    "memory_short": boolean,
    "memory_long": boolean,
    "orientation_issues": string[],
    "judgment_decline": boolean,
    "comprehension_decline": boolean,
    "attention_decline": boolean,
    "behavior_symptoms": string[],
    "psychological": string[],
    "comprehension_level": string | null,
    "expression_level": string | null,
    "vision": string | null,
    "hearing": string | null,
    "opinion": string | null
  },
  "family": {
    "housing": string | null,
    "cohabitants": string[],
    "children_sons": number | null,
    "children_daughters": number | null,
    "primary_caregiver_relation": string | null,
    "caregiver_burden": string | null,
    "social_interaction": string | null,
    "community_resources": string[],
    "opinion": string | null
  },
  "environment": {
    "floor": string | null,
    "has_elevator": boolean,
    "has_stairs": boolean,
    "has_thresholds": boolean,
    "bathroom_inside": boolean,
    "has_toilet_seat": boolean,
    "has_hot_water": boolean,
    "has_shower": boolean,
    "opinion": string | null
  },
  "desired_services": {
    "personal_hygiene": string[],
    "bathing": boolean,
    "position_change": boolean,
    "meal_assist": boolean,
    "mobility_assist": boolean,
    "toileting_assist": boolean,
    "meal_prep": boolean,
    "cleaning": boolean,
    "laundry": boolean,
    "shopping": boolean,
    "medication_help": boolean,
    "outings": string[],
    "rehab_training": string[],
    "cognitive_support": string[],
    "health_nursing": string[],
    "visiting_bath": string | null,
    "welfare_equipment": string | null,
    "opinion": string | null
  },
  "summary": {
    "health": string | null,
    "function": string | null,
    "cognition": string | null,
    "plan_direction": string | null
  }
}`;

function normalizeMobility(p: any): string | null {
  if (!p?.physical) return null;
  const parts = [];
  if (p.physical.walking_state) parts.push(p.physical.walking_state);
  if (p.physical.assistive_device?.length) parts.push(`보조기구: ${p.physical.assistive_device.join(", ")}`);
  if (p.physical.falls_3mo) parts.push(`지난 3개월 낙상 ${p.physical.falls_3mo}회`);
  return parts.join(". ") || null;
}

function normalizeMeal(p: any): string | null {
  const h = p?.health;
  if (!h) return null;
  const parts = [];
  if (h.meal_form) parts.push(`식사형태: ${h.meal_form}`);
  if (h.therapy_diet) parts.push(`치료식: ${h.therapy_diet}`);
  if (h.nutrition_state) parts.push(`영양상태: ${h.nutrition_state}`);
  if (h.opinion) parts.push(h.opinion);
  return parts.join("\n") || null;
}

async function extractPdf(pdfPath: string): Promise<any> {
  const buf = fs.readFileSync(pdfPath);
  const res = await model.generateContent([
    { text: EXTRACT_PROMPT },
    { inlineData: { data: buf.toString("base64"), mimeType: "application/pdf" } },
  ]);
  const text = res.response.text().trim();
  const json = text.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  return JSON.parse(json);
}

function scoreToNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : null;
}

async function applyExtracted(e: any) {
  const name = e.basic?.name?.trim();
  if (!name) throw new Error("no name extracted");

  let existing: { id: number } | null = null;
  if (e.basic.long_term_care_id) {
    const { data } = await sb
      .from("seniors")
      .select("id")
      .eq("long_term_care_id", e.basic.long_term_care_id)
      .maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await sb.from("seniors").select("id").eq("name", name).maybeSingle();
    existing = data;
  }

  const adl = e.adl ?? {};
  const physical = e.physical ?? {};
  const nursing = e.nursing ?? {};
  const cognition = e.cognition ?? {};
  const family = e.family ?? {};
  const env = e.environment ?? {};
  const desired = e.desired_services ?? {};
  const health = e.health ?? {};

  const patch: Record<string, any> = {
    name,
    birth_date: e.basic.birth_date,
    long_term_care_id: e.basic.long_term_care_id,
    grade: e.basic.grade,
    status: "active",
    // 질환
    major_diseases: [
      ...(e.health?.diseases ?? []),
      ...(e.health?.cancer ? [`암: ${e.health.cancer}`] : []),
    ],
    physical_status: [
      e.health?.opinion,
      e.nursing?.opinion,
    ].filter(Boolean).join("\n") || null,
    mobility: normalizeMobility(e),
    cognitive_memory: e.cognition?.opinion,
    cognitive_behavior: (e.cognition?.behavior_symptoms ?? []).join(", ") || null,
    // 욕구사정 10개 영역
    assess_meal: normalizeMeal(e),
    assess_mobility: normalizeMobility(e),
    assess_physical: e.nursing?.opinion,
    assess_excretion: [e.adl?.urination, e.adl?.urination_method, e.adl?.defecation, e.adl?.defecation_method].filter(Boolean).join("; ") || null,
    assess_hygiene: null,
    assess_adl: e.adl?.opinion,
    assess_cognition: e.cognition?.opinion,
    assess_behavior: [
      ...(e.cognition?.behavior_symptoms ?? []),
      ...(e.cognition?.psychological ?? []),
    ].join(", ") || null,
    assess_family_env: e.family?.opinion,
    assess_summary: [
      e.summary?.health,
      e.summary?.function,
      e.summary?.cognition,
      e.summary?.plan_direction,
    ].filter(Boolean).map((x, i) => `${["건강상태","생활/신체","인지/의사소통","급여계획"][i]}: ${x}`).join("\n\n") || null,
    assess_updated_at: e.basic?.assessed_at ? new Date(e.basic.assessed_at).toISOString() : new Date().toISOString(),
    // 희망 서비스
    essential_services: [
      ...(desired.personal_hygiene ?? []).map((x: string) => `개인위생-${x}`),
      ...(desired.bathing ? ["몸씻기(목욕)"] : []),
      ...(desired.meal_assist ? ["식사도움"] : []),
      ...(desired.mobility_assist ? ["이동도움"] : []),
      ...(desired.toileting_assist ? ["화장실이용"] : []),
      ...(desired.medication_help ? ["복약도움"] : []),
    ],
    // 새 상세 필드
    height_cm: health.height_cm ?? null,
    weight_kg: health.weight_kg ?? null,
    bmi: health.bmi ?? null,
    meal_form: health.meal_form ?? null,
    therapy_diet: health.therapy_diet ?? null,
    nutrition_state: health.nutrition_state ?? null,
    medications: health.medications ?? null,
    adl_scores: {
      washing_face: scoreToNum(adl.washing_face),
      brushing_teeth: scoreToNum(adl.brushing_teeth),
      toileting: scoreToNum(adl.toileting),
      bathing: scoreToNum(adl.bathing),
      dressing: scoreToNum(adl.dressing),
      eating: scoreToNum(adl.eating),
      swallowing: scoreToNum(adl.swallowing),
      cleaning: scoreToNum(adl.cleaning),
      meal_prep: scoreToNum(adl.meal_prep),
      laundry: scoreToNum(adl.laundry),
      transport: scoreToNum(adl.transport),
      medication: scoreToNum(adl.medication),
      shopping: scoreToNum(adl.shopping),
    },
    urination_state: adl.urination ?? null,
    urination_method: adl.urination_method ? [adl.urination_method] : [],
    defecation_state: adl.defecation ?? null,
    defecation_method: adl.defecation_method ? [adl.defecation_method] : [],
    musculoskeletal: {
      joint_contracture: !!physical.joint_contracture,
      motor_disorder: !!physical.motor_disorder,
      paralysis: !!physical.paralysis,
      amputation: !!physical.amputation,
    },
    walking_state: physical.walking_state ?? null,
    assistive_devices: physical.assistive_device ?? [],
    falls_3mo: physical.falls_3mo ?? 0,
    physical_scores: {
      rolling: scoreToNum(physical.rolling),
      sitting_up: scoreToNum(physical.sitting_up),
      standing_up: scoreToNum(physical.standing_up),
      indoor_walking: scoreToNum(physical.indoor_walking),
    },
    nursing_needs: {
      respiratory: nursing.respiratory ?? null,
      skin: nursing.skin ?? null,
      digestive: nursing.digestive ?? null,
      pain: nursing.pain ?? null,
      urinary: nursing.urinary ?? null,
      bowel: nursing.bowel ?? null,
      endocrine: nursing.endocrine ?? null,
    },
    cognition_flags: [
      ...(cognition.memory_short ? ["기억력-단기"] : []),
      ...(cognition.memory_long ? ["기억력-장기"] : []),
      ...(cognition.orientation_issues ?? []).map((o: string) => `지남력-${o}`),
      ...(cognition.judgment_decline ? ["판단력저하"] : []),
      ...(cognition.comprehension_decline ? ["이해력저하"] : []),
      ...(cognition.attention_decline ? ["주의력저하"] : []),
    ],
    behavior_flags: cognition.behavior_symptoms ?? [],
    psychological_flags: cognition.psychological ?? [],
    comprehension_level: cognition.comprehension_level ?? null,
    expression_level: cognition.expression_level ?? null,
    vision_state: cognition.vision ?? null,
    hearing_state: cognition.hearing ?? null,
    children_sons: family.children_sons ?? null,
    children_daughters: family.children_daughters ?? null,
    cohabitants: family.cohabitants ?? [],
    primary_caregiver_relation: family.primary_caregiver_relation ?? null,
    caregiver_burden: family.caregiver_burden ?? null,
    social_interaction: family.social_interaction ?? null,
    community_resources: family.community_resources ?? [],
    environment: {
      floor: env.floor ?? null,
      has_elevator: !!env.has_elevator,
      has_stairs: !!env.has_stairs,
      has_thresholds: !!env.has_thresholds,
      bathroom_inside: !!env.bathroom_inside,
      has_toilet_seat: !!env.has_toilet_seat,
      has_hot_water: !!env.has_hot_water,
      has_shower: !!env.has_shower,
    },
    desired_services: desired,
    summary_health: e.summary?.health ?? null,
    summary_function: e.summary?.function ?? null,
    summary_cognition: e.summary?.cognition ?? null,
    summary_plan: e.summary?.plan_direction ?? null,
  };

  // 빈 배열이나 null 제거해서 기존 데이터 보존
  for (const k of Object.keys(patch)) {
    if (patch[k] === null || (Array.isArray(patch[k]) && patch[k].length === 0)) {
      delete patch[k];
    }
  }

  let seniorId: number;
  let action: string;
  if (existing) {
    await sb.from("seniors").update(patch).eq("id", existing.id);
    seniorId = existing.id;
    action = "updated";
  } else {
    const { data, error } = await sb.from("seniors").insert(patch).select("id").single();
    if (error) throw error;
    seniorId = data.id;
    action = "inserted";
  }

  // assessments 이력 저장 (버전 자동 증가)
  const { data: prevVer } = await sb
    .from("assessments")
    .select("version")
    .eq("senior_id", seniorId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (prevVer?.version ?? 0) + 1;

  const { data: fullSenior } = await sb.from("seniors").select("*").eq("id", seniorId).single();

  await sb.from("assessments").insert({
    senior_id: seniorId,
    version,
    assessed_at: e.basic?.assessed_at ? new Date(e.basic.assessed_at).toISOString() : new Date().toISOString(),
    assessor_name: e.basic?.assessor_name ?? null,
    survey_type: e.basic?.survey_type ?? null,
    source: "pdf_import",
    snapshot: fullSenior,
  });

  return { action, id: seniorId, version };
}

const CONCURRENCY = 8;

async function processOne(f: string, idx: number, total: number) {
  const pdf = path.join(PDF_DIR, f);
  try {
    const extracted = await extractPdf(pdf);
    const result = await applyExtracted(extracted);
    console.log(`[${idx}/${total}] ${f} → ${result.action} #${result.id}`);
    return { ok: true };
  } catch (e: any) {
    console.log(`[${idx}/${total}] ${f} → FAILED: ${e.message}`);
    return { ok: false };
  }
}

async function main() {
  const files = fs.readdirSync(PDF_DIR)
    .filter(f => f.endsWith(".pdf") && !f.startsWith("._"))
    .sort();
  console.log(`Found ${files.length} PDFs, concurrency=${CONCURRENCY}`);

  let ok = 0, fail = 0;
  let next = 0;
  const total = files.length;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= files.length) return;
      const r = await processOne(files[i], i + 1, total);
      if (r.ok) ok++; else fail++;
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\nDone. ok=${ok}, failed=${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
