import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export type FallScores = {
  age: number;
  mental: number;
  bowel: number;
  fall_history: number;
  activity: number;
  gait: number;
  medication: number;
};

const ALLOWED: Record<keyof FallScores, number[]> = {
  age: [0, 1, 2, 3],
  mental: [0, 2, 4],
  bowel: [0, 1, 3, 4],
  fall_history: [0, 2, 4],
  activity: [0, 1, 3, 4],
  gait: [0, 2, 3, 4],
  medication: [0, 2, 3, 4],
};

function clampToAllowed(key: keyof FallScores, value: number): number {
  const allowed = ALLOWED[key];
  if (allowed.includes(value)) return value;
  // 허용 값 중 가장 가까운 값으로 보정
  return allowed.reduce((best, cur) => (Math.abs(cur - value) < Math.abs(best - value) ? cur : best), allowed[0]);
}

export function interpret(total: number): string {
  if (total <= 4) return "낙상위험 낮음";
  if (total <= 10) return "낙상위험 높음";
  return "낙상위험 아주 높음";
}

const SCORING_RULE = `Huhn 낙상위험도 평가도구 점수 기준 (표에 있는 값만 사용, 해당사항 없으면 0점):
- 연령: >80세=3점, 70-79세=2점, 60-69세=1점, 60세 미만=0점
- 정신상태: 혼란스러움/방향감각장애=4점, 때때로 혼란스러움=2점, 정상=0점
- 배변: 소변·대변 실금=4점, 조절능력 있으나 도움필요=3점, 유치도뇨관/인공항루=1점, 정상=0점
- 낙상경험: 3회 이상=4점, 1-2회=2점, 없음=0점
- 활동: 거의 누워 있음=4점, 앉기 도움 필요=3점, 자립/세면대 이용=1점, 완전 자립으로 활동=0점
- 걸음걸이/균형: 불규칙·불안정=4점, 일어설 때 기립성 빈혈=3점, 보행장애/보조도구/도움=2점, 정상=0점
- 약복용: 3개 이상=4점, 두 가지=3점, 한 가지=2점, 복용 안 함=0점
`;

export async function suggestFallScores(intakeData: Record<string, any>): Promise<{
  scores: FallScores;
  total: number;
  interpretation: string;
  notes: string;
}> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const prompt = `${NO_HALLUCINATION_RULES}

당신은 재가장기요양 사회복지사. 아래 초기상담기록지 내용만 근거로 낙상위험 7개 항목 점수를 매긴다.
${SCORING_RULE}

정확히 아래 JSON만 출력. 다른 텍스트 금지.
{
  "age": 정수(허용값만),
  "mental": 정수,
  "bowel": 정수,
  "fall_history": 정수,
  "activity": 정수,
  "gait": 정수,
  "medication": 정수,
  "notes": "* 부호로 시작하는 평가 코멘트 1~2문장. 낙상 위험 수준과 근거를 담담히 기술. 50대 사회복지사가 쓰는 평어체."
}

[초기상담기록지 데이터]
${JSON.stringify(intakeData, null, 2)}

근거 없으면 0점. 확신 없을 때도 허용 점수 중 가장 낮은 값 쪽으로.`;

  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  let parsed: any;
  try { parsed = JSON.parse(cleaned); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error("낙상평가 AI 응답 파싱 실패");
  }

  const scores: FallScores = {
    age: clampToAllowed("age", Number(parsed.age ?? 0)),
    mental: clampToAllowed("mental", Number(parsed.mental ?? 0)),
    bowel: clampToAllowed("bowel", Number(parsed.bowel ?? 0)),
    fall_history: clampToAllowed("fall_history", Number(parsed.fall_history ?? 0)),
    activity: clampToAllowed("activity", Number(parsed.activity ?? 0)),
    gait: clampToAllowed("gait", Number(parsed.gait ?? 0)),
    medication: clampToAllowed("medication", Number(parsed.medication ?? 0)),
  };
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  return {
    scores,
    total,
    interpretation: interpret(total),
    notes: String(parsed.notes ?? ""),
  };
}
