import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export type IntakeExtracted = {
  counseling_date?: string | null;
  counselor_name?: string | null;
  name?: string | null;
  gender?: "M" | "F" | null;
  birth_date?: string | null;
  grade?: string | null;
  education?: string | null;
  blood_type?: string | null;
  hometown?: string | null;
  economic_status?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  spouse?: boolean | null;
  guardian_name?: string | null;
  guardian_relation?: string | null;
  guardian_phone?: string | null;
  num_children?: string | null;
  cohabit?: string | null;
  cohabit_type?: string | null;
  meal_soft?: boolean | null;
  meal_note?: string | null;
  vision_note?: string | null;
  walking?: string | null;
  emotion?: string | null;
  personality?: string | null;
  habit?: string | null;
  eating?: string | null;
  toilet?: string | null;
  dentition?: string | null;
  bowel?: string | null;
  meal_form?: string | null;
  vision?: string | null;
  hearing?: string | null;
  speech?: string | null;
  service_use?: string | null;
  disease_history?: string | null;
  main_hospital?: string | null;
  diseases?: string[];
  medications?: string | null;
  individual_needs?: string | null;
  counselor_opinion?: string | null;
};

const PROMPT = `${NO_HALLUCINATION_RULES}

첨부된 PDF는 재가장기요양센터의 초기상담기록지다.
아래 JSON 스키마로 정확한 필드만 추출하라. 다른 텍스트 절대 금지.
입력에 없는 값은 null. 추정/창작 금지.

{
  "counseling_date": "YYYY-MM-DD 또는 null",
  "counselor_name": "기록자 이름 — 언급이 없으면 반드시 '박현식'",
  "name": "수급자 성명",
  "gender": "M | F | null",
  "birth_date": "YYYY-MM-DD",
  "grade": "예: 3등급",
  "education": "학력",
  "blood_type": "혈액형",
  "hometown": "고향",
  "economic_status": "일반 | 경감 | 기초 | null",
  "height_cm": 숫자,
  "weight_kg": 숫자,
  "spouse": true | false | null,
  "guardian_name": "보호자 성명",
  "guardian_relation": "보호자 관계 (예: 큰아들)",
  "guardian_phone": "연락처 (가장 대표 번호 하나)",
  "num_children": "자녀수 텍스트 그대로 (예: 3남 1녀)",
  "cohabit_type": "유 | 무 | 왕래 중 하나 (체크된 항목)",
  "cohabit": "동거여부 부연 설명 (예: 주1~2회, 배우자 동거, 같은 건물 2층 등)",
  "walking": "자립 | 도움 | 완전도움",
  "emotion": "안정됨 | 조금불안 | 불안정",
  "personality": "적극 | 보통 | 조용",
  "habit": "음주/흡연/수면/기타 중 체크된 것 연결",
  "eating": "자립 | 도움 | 완전도움",
  "toilet": "자립 | 도움 | 완전도움",
  "dentition": "의치/잔존치아/틀니/기타 중 체크된 것 원문",
  "bowel": "정상 | 설사 | 변비 | 기저귀 | 소변주머니 중 체크",
  "meal_form": "일반식 | 유동식(죽) | 경관식 중 하나",
  "meal_soft": "다짐찬 체크 여부 (true/false/null)",
  "meal_note": "식사 관련 부연 설명 (예: 부드러운 음식 위주)",
  "vision": "양호 | 불가능 | 안경착용 등",
  "hearing": "양호 | 큰소리로 말할 경우 가능 | 보청기 착용 등",
  "speech": "양호 | 묻는 말에만 대답 | 불가능",
  "service_use": "없음 | 타 주간보호센터 | 타 기관 등 원문",
  "disease_history": "발병시기 섹션 전체 텍스트 (여러 줄 그대로)",
  "main_hospital": "주의료기관",
  "diseases": ["체크된 질환 라벨들 배열 — 예: 당뇨, 고혈압, 우울증, 수면장애, 관절염, 요통, 요실금"],
  "medications": "복용약 원문",
  "individual_needs": "개별욕구 원문",
  "counselor_opinion": "상담자의견 원문"
}
`;

function parseJsonResponse(raw: string): IntakeExtracted {
  const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("AI JSON 파싱 실패");
  }
}

export async function extractIntakeFromPDF(pdfBuffer: Buffer): Promise<IntakeExtracted> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });
  const res = await model.generateContent([
    { text: PROMPT },
    { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
  ]);
  return parseJsonResponse(res.response.text().trim());
}

const TEXT_PROMPT = `${NO_HALLUCINATION_RULES}

아래는 재가장기요양센터 초기상담 내용이다 (녹취 또는 상담자가 직접 기록한 텍스트).
이 내용에서 초기상담기록지 양식에 맞춰 JSON으로 정확한 필드만 추출하라. 다른 텍스트 절대 금지.
내용에 언급이 없는 값은 null. 추정/창작 금지.

{
  "counseling_date": "YYYY-MM-DD 또는 null",
  "counselor_name": "기록자 이름 — 언급이 없으면 반드시 '박현식'",
  "name": "수급자 성명",
  "gender": "M | F | null",
  "birth_date": "YYYY-MM-DD",
  "grade": "예: 3등급",
  "education": "학력",
  "blood_type": "혈액형",
  "hometown": "고향",
  "economic_status": "일반 | 경감 | 기초 | null",
  "height_cm": 숫자,
  "weight_kg": 숫자,
  "spouse": true | false | null,
  "guardian_name": "보호자 성명",
  "guardian_relation": "보호자 관계 (예: 큰아들)",
  "guardian_phone": "연락처 (가장 대표 번호 하나)",
  "num_children": "자녀수 텍스트 그대로 (예: 3남 1녀)",
  "cohabit_type": "유 | 무 | 왕래 중 하나 (체크된 항목)",
  "cohabit": "동거여부 부연 설명 (예: 주1~2회, 배우자 동거, 같은 건물 2층 등)",
  "walking": "자립 | 도움 | 완전도움",
  "emotion": "안정됨 | 조금불안 | 불안정",
  "personality": "적극 | 보통 | 조용",
  "habit": "음주/흡연/수면/기타 중 체크된 것 연결",
  "eating": "자립 | 도움 | 완전도움",
  "toilet": "자립 | 도움 | 완전도움",
  "dentition": "의치/잔존치아/틀니/기타 중 체크된 것 원문",
  "bowel": "정상 | 설사 | 변비 | 기저귀 | 소변주머니 중 체크",
  "meal_form": "일반식 | 유동식(죽) | 경관식 중 하나",
  "meal_soft": "다짐찬 체크 여부 (true/false/null)",
  "meal_note": "식사 관련 부연 설명 (예: 부드러운 음식 위주)",
  "vision": "양호 | 불가능 | 안경착용 등",
  "hearing": "양호 | 큰소리로 말할 경우 가능 | 보청기 착용 등",
  "speech": "양호 | 묻는 말에만 대답 | 불가능",
  "service_use": "없음 | 타 주간보호센터 | 타 기관 등 원문",
  "disease_history": "발병시기/병력 요약 (녹음·원문을 그대로 옮기지 말고 2~4문장으로 핵심 정리: 언제 어떤 병을 진단받았는지, 현재 치료 상태)",
  "main_hospital": "주의료기관",
  "diseases": ["언급된 질환 라벨들 배열 — 예: 당뇨, 고혈압, 우울증, 수면장애, 관절염, 요통, 요실금"],
  "medications": "복용약 (약 이름만 쉼표로 정리, 부연 설명 제거)",
  "individual_needs": "개별욕구 요약 (2~3문장, 필요한 도움 중심으로 간결하게)",
  "counselor_opinion": "상담자의견 요약 (3~4문장, 종합적 판단)"
}

※ 중요: narrative 필드(disease_history, individual_needs, counselor_opinion)는
- 녹음·원문을 **그대로 옮기지 말 것**.
- 구어체("~셨어요", "~하신 것 같아") · 감탄사 · 반복 · "어~ 그~" 같은 말버릇 제거.
- 서술체 경어("~이심", "~필요함", "~드심")로 정돈.
- 핵심 사실만 간결하게 정리.
- 원문의 사실은 100% 보존하되 문장은 다듬는다.
`;

export async function extractIntakeFromText(text: string): Promise<IntakeExtracted> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });
  const res = await model.generateContent([
    { text: TEXT_PROMPT },
    { text: `[상담 내용]\n${text}` },
  ]);
  return parseJsonResponse(res.response.text().trim());
}

export async function extractIntakeFromAudio(audio: Buffer, mimeType: string): Promise<{ transcript: string; extracted: IntakeExtracted }> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: LOW_TEMP_GENERATION_CONFIG,
  });
  const transcribeRes = await model.generateContent([
    {
      text: `다음 음성은 재가장기요양센터의 초기상담 녹음이다.
한국어로 **들리는 그대로** 받아적으세요.
- 들리지 않거나 알아들을 수 없는 부분은 [불분명] 으로 표기.
- 추측해서 채우지 마세요.
- 받아쓴 내용만 출력. 설명·머리말 금지.`,
    },
    { inlineData: { data: audio.toString("base64"), mimeType } },
  ]);
  const transcript = transcribeRes.response.text().trim();
  if (!transcript) throw new Error("음성 인식 결과가 비어있습니다");
  const extracted = await extractIntakeFromText(transcript);
  return { transcript, extracted };
}
