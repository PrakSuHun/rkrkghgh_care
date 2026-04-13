import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export const SUMMARY_FIELDS = [
  { key: "assess_meal", label: "01. 식사 및 영양상태" },
  { key: "assess_mobility", label: "02. 보행" },
  { key: "assess_physical", label: "03. 신체기능" },
  { key: "assess_excretion", label: "04. 배뇨, 배변기능" },
  { key: "assess_hygiene", label: "05. 위생 관리" },
  { key: "assess_adl", label: "06. 일상생활수행 (ADL)" },
  { key: "assess_cognition", label: "07. 인지기능" },
  { key: "assess_behavior", label: "08. 행동증상" },
  { key: "assess_family_env", label: "09. 가족 및 생활환경" },
  { key: "assess_summary", label: "10. 기타 및 종합의견" },
] as const;

const STYLE_EXAMPLES = `
[예시 1: 강섭순]
01. 식사 및 영양상태: 신장장애 및 당뇨질환으로 인한 기력저하로 소량의 식사를 하고 있으며, 식단관리가 필요하고 영양상태에 대한 세심한 관찰이 요구됨.
02. 보행: 단독보행은 가능하나 기력저하와 어지럼증으로 낙상 위험이 높아 보조기구(지팡이)를 이용한 안전한 이동관리가 필요하며 지켜보기도움이 요구됨.
03. 신체기능: 신장장애2급으로 주4회 혈액투석 중이며 심부전증, 당뇨, 우울증 등 여러 만성질환이 있고 기력저하와 어지럼증으로 신체적 기능 저하가 있음. 운동장애나 관절구축은 없음.
04. 배뇨, 배변기능: 요실금이 있으나 배설상태는 양호한 것으로 관찰됨.
05. 위생 관리: 개인 위생관리는 신체 잔존기능을 활용하여 가능한 부분은 스스로 수행하고 있으나, 요양보호사의 도움을 통해 청결유지와 자존감 향상을 지원받고 있음.
06. 일상생활수행 (ADL): 체위변경, 일어나 앉기, 세수, 양치질 등은 자력 수행 가능하나 이동, 실내외 보행, 약 복용, 화장실 사용 등은 낙상 위험이 있어 지켜보기도움이 필요하며, 취사, 청소, 세탁, 목욕 등은 스스로 수행이 어려워 지원이 요구됨.
07. 인지기능: 인지선별검사 결과 인지력은 양호한 편으로 인지기능 예방활동을 수행하고 있음.
08. 행동증상: 오랜 지병으로 인한 우울증이 있으며 정서적 안정과 생활의욕 향상을 위해 말벗 및 격려, 위로가 필요한 상태임.
09. 가족 및 생활환경: 아파트에서 거주하며 안전손잡이, 목욕의자, 미끄럼방지용품 등 복지용구를 사용 중이고, 배우자와 함께 생활하나 배우자도 암 환자로 신체적 부양 부담이 있음. 세 아들은 별거 중임.
10. 기타 및 종합의견: 다수의 만성질환과 기력저하, 낙상 위험이 있으나 인지력은 양호하여 기능 유지 및 악화 방지를 위한 다각적인 지원과 관리가 필요함. 일상생활 지원과 정서적 지지, 안전한 환경 조성 및 복지용구 활용을 통하여 삶의 질 향상을 도모해야 함.

[예시 2: 강신성]
01. 식사 및 영양상태: 항암약 복용으로 인한 식욕부진과 치아 약화로 식사를 잘 못하시며, 균형 잡힌 식단 관리와 섭식에 대한 세심한 관찰과 식사지시 및 지켜보기 도움이 요구됨.
02. 보행: 천천히 단독 보행 가능하나 허리 및 골반 통증과 손 떨림, 숨 가쁨으로 인해 중심을 잡기 어려워 낙상 위험이 매우 높아 이동 시 주의와 도움 필요함.
03. 신체기능: 빈혈, 부정맥, 고혈압, 심장질환, 전립선암 등의 주요질환이 있으며, 항암약 복용과 방사선 치료로 기력 저하가 심하고 어지럼증 및 균형 상실로 안전한 이동 관리와 관절 구축 예방을 위한 운동 및 스트레칭 지원이 필요함.
04. 배뇨, 배변기능: 변비가 심해 관장을 자주 하며 소변 실수가 잦아 청결 상태 유지를 위한 도움과 관리가 필요함.
05. 위생 관리: 세수, 양치질 등 기본 개인위생은 스스로 수행 가능하나 항암 치료로 인한 기력 저하로 요양보호사 파견을 통한 개인위생 및 청결상태 유지 지원이 필요함.
06. 일상생활수행 (ADL): 체위 변경, 일어나 앉기, 식사하기 등은 스스로 가능하나 이동, 실내·외 보행, 약 챙겨먹기, 화장실 사용 등은 지켜보는 도움이 필요하며, 식사준비, 청소, 세탁, 목욕 등은 스스로 수행하기 어려워 도움 필요함.
07. 인지기능: 인지선별검사(CIST) 결과 인지력은 양호하나 기력 저하로 대부분 시간을 누워 지내며 우울감과 야간 수면장애를 겪고 있어 정서 지원과 인지 기능 예방활동(손체조운동, 스트레칭) 등의 지속적인 도움이 요구됨.
08. 행동증상: 우울감이 많고 옛날 이야기를 자주 하며 반복된 말을 하는 경향이 있어 정서 안정과 잔존 기능 유지, 삶의 질 향상을 위한 지속적인 정서지원과 프로그램이 필요함.
09. 가족 및 생활환경: 노후된 단독주택에서 독거 생활하며 난방은 연탄불을 사용함. 배우자는 3년 전 사별하였고 4남1녀 중 1명은 사망함. 둘째 아들과 며느리가 주 보호자로 주 1~2회 방문하며 대전 동구정다운 복지관 알림서비스를 신청함. 안전 손잡이, 미끄럼방지용품, 수동 휠체어 등 복지용품을 희망함.
10. 기타 및 종합의견: 전문적 돌봄과 지속적인 신체 및 정서 지원, 안전한 환경 개선이 필수적임. 항암 치료로 인한 체력 저하 및 낙상 위험에 대비한 세심한 건강관리는 물론 인지 기능 유지 및 정서적 안정을 위한 다양한 서비스 연계와 가족 및 지역사회 지지체계 활용이 필요함.
`;

export type SummaryResult = Record<typeof SUMMARY_FIELDS[number]["key"], string>;

export async function generateSummary(input: {
  senior: Record<string, any>;
  journals: Array<{ created_at: string | number; transcript?: string | null; summary?: string | null }>;
  prevSummary?: Record<string, string | null> | null;
}): Promise<SummaryResult> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: LOW_TEMP_GENERATION_CONFIG,
  });

  const s = input.senior;
  const journalText = input.journals.length === 0
    ? "(최근 일지 없음)"
    : input.journals
        .map((j, i) => {
          const date = new Date(j.created_at).toLocaleDateString("ko-KR");
          return `[일지 ${i + 1} · ${date}]\n요약: ${j.summary ?? "-"}\n원문: ${(j.transcript ?? "").slice(0, 800)}`;
        })
        .join("\n\n");

  const prevText = input.prevSummary
    ? SUMMARY_FIELDS.map((f) => `${f.label}: ${input.prevSummary?.[f.key] ?? "-"}`).join("\n")
    : "(이전 요약 없음)";

  const basicInfo = [
    `이름: ${s.name}`,
    `등급: ${s.grade ?? "-"}`,
    `생년월일: ${s.birth_date ?? "-"}`,
    `주거형태: ${s.address_type ?? "-"}`,
    `주요질환: ${(s.major_diseases ?? []).join(", ")}`,
    `복약: ${s.medications ?? "-"}`,
    `식사형태: ${s.meal_form ?? "-"}, 영양상태: ${s.nutrition_state ?? "-"}`,
    `보행: ${s.walking_state ?? "-"}, 보조기구: ${(s.assistive_devices ?? []).join(", ")}, 3개월 낙상: ${s.falls_3mo ?? 0}회`,
    `인지: ${(s.cognition_flags ?? []).join(", ")}`,
    `행동증상: ${(s.behavior_flags ?? []).join(", ")}`,
    `가족: 아들 ${s.children_sons ?? "?"}명, 딸 ${s.children_daughters ?? "?"}명, 동거 ${(s.cohabitants ?? []).join(",")}, 주수발자관계: ${s.primary_caregiver_relation ?? "-"}`,
    `희망서비스: ${(s.essential_services ?? []).join(", ")}`,
  ].join("\n");

  const prompt = `당신은 재가장기요양 사회복지사입니다. 어르신의 기본정보와 최근 돌봄일지를 종합하여 욕구사정 요약 10개 영역을 한국어로 작성하세요.

${NO_HALLUCINATION_RULES}

${PERSONA_WRITING_RULES}

갱신 원칙:
- 이전 요약을 기본으로 유지. 최근 일지에서 **새로 확인된 변화만** 반영하여 한두 표현만 가볍게 업데이트.
- 변화가 없는 영역은 이전 문장을 거의 그대로 유지 (조사·어휘만 살짝 다듬기).
- 큰 폭으로 다시 쓰지 마세요. 점진적 보완이 원칙.


${STYLE_EXAMPLES}

[작성 대상 어르신 정보]
${basicInfo}

[이전 요약 (최근 갱신본)]
${prevText}

[최근 일지 (최근 3주)]
${journalText}

위 정보를 모두 종합하여, 다음 JSON 스키마로 출력하세요. 설명 문구 없이 JSON만 출력:
{
  "assess_meal": "01. 식사 및 영양상태에 해당하는 1~3문장",
  "assess_mobility": "...",
  "assess_physical": "...",
  "assess_excretion": "...",
  "assess_hygiene": "...",
  "assess_adl": "...",
  "assess_cognition": "...",
  "assess_behavior": "...",
  "assess_family_env": "...",
  "assess_summary": "..."
}`;

  const res = await model.generateContent(prompt);
  const text = res.response.text().trim();
  const json = text.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  return JSON.parse(json);
}
