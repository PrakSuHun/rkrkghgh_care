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
  previousAssessment?: any;
  surveyType?: string;
  extra?: Record<string, any>;
}): Promise<NeedsAssessmentFull> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const journalText = (ctx.journals ?? []).slice(0, 10).map((j: any) => `[${(j.created_at ?? "").slice(0, 10)}] ${j.summary ?? ""}`).join("\n\n") || "(없음)";
  const surveyType = ctx.surveyType ?? "최초";
  const hasPrev = !!ctx.previousAssessment;

  const updateRule = hasPrev ? `
갱신 원칙 (정기 갱신):
- 아래 [이전 욕구사정 결과]를 기본으로 유지하되, [최근 일지 요약]에서 새로 확인된 변화만 반영.
- 변화가 없는 영역은 이전 내용을 거의 그대로 유지 (조사·어휘만 살짝 다듬기).
- 일지에서 확인된 상태 변화가 있으면 해당 체크박스, 점수(ADL 0~3), 질환 배열도 적극 변경.
- 예: 일지에 "최근 낙상 2회" → falls_3mo를 2로 변경. "식사 거부" → 영양상태 불량으로 변경.
- 큰 폭으로 전면 다시 쓰지 말고 점진적 보완.

[이전 욕구사정 결과]
${JSON.stringify(ctx.previousAssessment, null, 2)}
` : `
최초 생성: 초기상담기록지와 대상자 기본정보를 근거로 전체 서식을 채움.
일지가 있으면 일지 내용도 반영하여 체크박스와 점수를 적절히 설정.
`;

  const prompt = `${NO_HALLUCINATION_RULES}
${PERSONA_WRITING_RULES}

공단 욕구조사기록지(5페이지) 표준 서식의 모든 필드를 아래 JSON 스키마로 출력한다. 다른 텍스트 금지.
욕구조사 유형: "${surveyType}"
기관명: ${CENTER_INFO.name}
기관기호: ${CENTER_INFO.code}
작성자: ${CENTER_INFO.head}

${updateRule}

[대상자 기본정보]
${JSON.stringify(ctx.senior, null, 2)}

[초기상담기록지(있다면)]
${ctx.intake ? JSON.stringify(ctx.intake, null, 2) : "(없음)"}

[추가 입력 정보(사용자가 생성 직전 직접 입력한 값 — 반드시 반영)]
${ctx.extra && Object.keys(ctx.extra).length ? JSON.stringify(ctx.extra, null, 2) : "(없음)"}

[담당 요양보호사]
${(ctx.caregivers ?? []).join(", ") || "미배정"}

[최근 일지 요약]
${journalText}

체크박스/점수 변경 판단 기준 (반드시 준수):
- **1회 언급**: 의견(opinion)에 "~한 경우가 있었음" 정도로만 서술. 체크박스·점수는 변경하지 않음.
- **2회 반복**: 의견에 "주의 관찰 필요" 기술. 체크박스는 아직 변경하지 않음.
- **3회 이상 반복**: 체크박스·ADL 점수·질환 배열 등 실제 변경.
- **심각한 사건(낙상, 입원, 응급, 골절 등)**: 1회라도 즉시 체크박스 반영.
- **시간 가중치**: 최근 1주 일지의 비중이 2~3주 전 일지보다 높음.
- 근거 없는 항목은 이전 값 유지 또는 기본값(0, 양호, 없음).
- header.survey_type은 반드시 "${surveyType}"으로 설정.

스키마 (빈 값은 그대로, 없는 정보는 null/빈문자/0 사용, 창작 금지):
${SCHEMA}

※ 길이 제한 (반드시 준수):
- 각 섹션의 "opinion" 필드: **3문장 이내, 총 150자 이내**
- section10_summary의 health/function/cognition/care_plan_direction: 각 **5문장 이내, 250자 이내**
- 넘치면 인쇄 시 잘림. 핵심만 뽑아 간결하게.

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
