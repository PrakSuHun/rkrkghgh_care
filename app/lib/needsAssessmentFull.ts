import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";
import { CENTER_INFO } from "./centerInfo";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export type NeedsAssessmentFull = {
  header: any;
  section1_general: any;
  section2_health: any;
  section3_adl: any;
  section4_physical: any;
  section5_nursing: any;
  section6_cognition: any;
  section7_support: any;
  section8_environment: any;
  section9_desired: any;
  section10_summary: any;
};

const SCHEMA = `{
  "header": {
    "center_name": "...", "center_code": "...", "written_at": "YYYY-MM-DD",
    "writer_name": "...", "writer_role": "시설장(관리책임자)",
    "survey_type": "최초"
  },
  "section1_general": {
    "name": "", "gender": "M", "birth_date": "", "age": 0,
    "long_term_care_id": "", "grade": "",
    "interviewer_type": "수급자",
    "interviewer_name": "", "is_primary_caregiver": true
  },
  "section2_health": {
    "height_cm": 0, "weight_kg": 0, "bmi": 0,
    "diseases": {
      "neuro": [], "cardio": [], "endocrine": [], "musculo": [],
      "uro": [], "sensory": [], "infection": [], "other_cancer": null, "other_allergy": null, "other_other": null
    },
    "medication_none": false, "medication_regular": {"reason":"","hospital":"","interval":""}, "medication_irregular": null, "medication_sleep": false,
    "oral_status": "", "oral_health": "", "diet_form": "일반식", "therapeutic_diet": "해당 없음", "meal_notes": "",
    "nutrition": "양호",
    "opinion": ""
  },
  "section3_adl": {
    "wash": 0, "brush": 0, "toilet": 0, "bath": 0,
    "dress": 0, "eat": 0, "swallow": 0,
    "clean": 0, "cook": 0, "laundry": 0, "transport": 0, "medication": 0, "shopping": 0,
    "urination_function": "양호", "urination_method": "화장실",
    "defecation_function": "양호", "defecation_method": "화장실",
    "opinion": ""
  },
  "section4_physical": {
    "joint_contracture": "없음", "motor_disorder": "없음", "paralysis": "없음", "amputation": "없음",
    "gait": "자립보행 가능", "aids": [],
    "falls_3mo": 0,
    "turn": 0, "sit_up": 0, "stand": 0, "walk": 0,
    "opinion": ""
  },
  "section5_nursing": {
    "respiratory": "없음", "skin": "없음", "digestive": "없음",
    "pain_type": "없음", "pain_site": "", "pain_score": 0, "pain_freq": "", "pain_manage": "",
    "urination_care": "없음", "defecation_care": "없음", "endocrine": "없음",
    "opinion": ""
  },
  "section6_cognition": {
    "cognitive": [], "behavior": [], "psychological": [],
    "comm_understand": "양호", "comm_express": "양호", "comm_vision": "정상", "comm_hearing": "정상",
    "opinion": ""
  },
  "section7_support": {
    "residence": "자택", "cohabitant": [],
    "children_son": 0, "children_daughter": 0,
    "primary_caregiver_present": true, "primary_caregiver_relation": "", "primary_caregiver_burden": "",
    "social_family": "", "social_friends": "",
    "community": [],
    "opinion": ""
  },
  "section8_environment": {
    "floor": "1층",
    "elevator": false, "stairs": false, "thresholds": false,
    "floor_wall": "양호", "hvac": "양호", "lighting": "양호", "kitchen": "양호",
    "toilet_location": "실내", "toilet_seat": true, "hot_water": true, "shower": true, "sink": true,
    "opinion": ""
  },
  "section9_desired": {
    "physical": [], "daily": [], "rehab": [], "cognition": [], "health": [], "bath": [],
    "aids": [], "community": [],
    "opinion": ""
  },
  "section10_summary": {
    "health": "", "function": "", "cognition": "", "care_plan_direction": ""
  }
}`;

export async function generateNeedsAssessmentFull(ctx: {
  senior: any;
  intake?: any;
  journals?: any[];
  caregivers?: string[];
}): Promise<NeedsAssessmentFull> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const journalText = (ctx.journals ?? []).slice(0, 10).map((j: any) => `[${(j.created_at ?? "").slice(0, 10)}] ${j.summary ?? ""}`).join("\n\n") || "(없음)";

  const prompt = `${NO_HALLUCINATION_RULES}
${PERSONA_WRITING_RULES}

공단 욕구조사기록지(5페이지) 표준 서식의 모든 필드를 아래 JSON 스키마로 출력한다. 다른 텍스트 금지.
기관명: ${CENTER_INFO.name}
기관기호: ${CENTER_INFO.code}
작성자: ${CENTER_INFO.head}

[대상자 기본정보]
${JSON.stringify(ctx.senior, null, 2)}

[초기상담기록지(있다면)]
${ctx.intake ? JSON.stringify(ctx.intake, null, 2) : "(없음)"}

[담당 요양보호사]
${(ctx.caregivers ?? []).join(", ") || "미배정"}

[최근 일지 요약]
${journalText}

스키마 (빈 값은 그대로, 없는 정보는 null/빈문자/0 사용, 창작 금지):
${SCHEMA}

JSON만 출력.`;

  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  try { return JSON.parse(cleaned); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("AI JSON 파싱 실패");
  }
}
