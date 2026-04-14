import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export type MeetingType =
  | "monthly_staff"
  | "case_conference"
  | "safety_edu"
  | "infection_edu"
  | "dementia_edu"
  | "human_rights_edu"
  | "harassment_edu"
  | "handover";

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  monthly_staff: "월례 직원회의",
  case_conference: "사례회의",
  safety_edu: "안전교육",
  infection_edu: "감염관리 교육",
  dementia_edu: "치매관리 교육",
  human_rights_edu: "노인인권 교육",
  harassment_edu: "성희롱예방 교육",
  handover: "인수인계 회의",
};

type GenInput = {
  meetingType: MeetingType;
  heldAt: string;
  attendees: string[]; // worker names
  topic?: string;
  relatedSenior?: { name: string; grade: string | null; journals: string[]; assessSummary: string | null };
  fromWorker?: string;
  toWorker?: string;
  centerContext?: { newSeniors?: string[]; endedSeniors?: string[]; newWorkers?: string[]; pendingCounseling?: string[] };
};

function basePrompt(input: GenInput): string {
  const t = MEETING_TYPE_LABEL[input.meetingType];
  const attendee = input.attendees.length ? input.attendees.join(", ") : "전 직원";
  const base = `
${NO_HALLUCINATION_RULES}
${PERSONA_WRITING_RULES}

재가장기요양센터의 "${t}" 회의록을 작성합니다.
개최일: ${input.heldAt}
참석자: ${attendee}

아래 JSON 형식으로만 응답하세요. 다른 텍스트 절대 금지.
{
  "agenda": "안건 요약 한두 줄",
  "content": "논의 내용 본문. 줄바꿈으로 문단 구분. 평어체.",
  "decisions": "결정사항/조치사항. 줄바꿈으로 항목 구분. 평어체."
}
`;
  return base;
}

function typeSpecificPrompt(input: GenInput): string {
  switch (input.meetingType) {
    case "monthly_staff": {
      const ctx = input.centerContext ?? {};
      return `
이달 센터 운영 상황:
- 신규 대상자: ${ctx.newSeniors?.join(", ") || "없음"}
- 종결 대상자: ${ctx.endedSeniors?.join(", ") || "없음"}
- 신규 요양사: ${ctx.newWorkers?.join(", ") || "없음"}
- 상담 미진행 요양사: ${ctx.pendingCounseling?.join(", ") || "없음"}

안건으로 전월 업무보고, 이달 일정, 어르신 관련 이슈, 요양사 건의사항을 다룹니다.
위 상황에 근거해 논의내용을 작성하세요. 추측 금지.`;
    }
    case "case_conference": {
      const s = input.relatedSenior!;
      const j = s.journals.length ? s.journals.join("\n---\n") : "최근 일지 없음";
      return `
대상 어르신: ${s.name} (등급 ${s.grade ?? "미확인"})
최근 일지 요약들:
${j}
욕구사정 종합의견: ${s.assessSummary ?? "없음"}

이 어르신의 상태변화, 서비스 조정 필요성, 향후 돌봄 방향을 위 자료에 근거해 논의내용으로 기술하세요. 없는 사실 창작 금지.`;
    }
    case "safety_edu":
      return `
교육 주제: ${input.topic || "낙상예방 및 응급처치"}
위 주제로 60분 교육을 실시했다고 가정하고, 표준 안전교육 커리큘럼(위험요인 인식, 예방수칙, 응급 대응, 질의응답)으로 논의내용을 작성하세요.`;
    case "infection_edu":
      return `
표준 감염관리 교육 커리큘럼(손위생, 개인보호구, 호흡기 감염 예방, 환경 소독, 유증상자 대응)으로 60분 교육 논의내용을 작성하세요.`;
    case "dementia_edu":
      return `
표준 치매관리 교육 커리큘럼(치매 이해, 행동심리증상 대응, 의사소통 기법, 가족 지지)으로 4시간 교육 논의내용을 작성하세요.`;
    case "human_rights_edu":
      return `
표준 노인인권 교육 커리큘럼(학대 예방, 존엄케어, 사생활 보호, 자기결정권 존중, 신고절차)으로 교육 논의내용을 작성하세요.`;
    case "harassment_edu":
      return `
표준 성희롱예방 교육 커리큘럼(성희롱 개념, 사례, 예방수칙, 신고 및 구제 절차, 가해자 조치)으로 교육 논의내용을 작성하세요.`;
    case "handover": {
      const s = input.relatedSenior!;
      const j = s.journals.length ? s.journals.join("\n---\n") : "특이사항 없음";
      return `
인수인계 대상 어르신: ${s.name} (등급 ${s.grade ?? "미확인"})
전임 요양사: ${input.fromWorker ?? "미지정"}
후임 요양사: ${input.toWorker ?? "미지정"}
최근 일지:
${j}
욕구사정 종합의견: ${s.assessSummary ?? "없음"}

위 자료에 근거해 전달할 특이사항, 생활 리듬, 가족 연락 요령, 주의할 점을 논의내용으로 정리하세요. 없는 사실 창작 금지.`;
    }
  }
}

export async function generateMeeting(input: GenInput) {
  const prompt = basePrompt(input) + "\n" + typeSpecificPrompt(input);
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });
  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  let parsed: { agenda?: string; content?: string; decisions?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
  }
  return {
    agenda: parsed.agenda ?? "",
    content: parsed.content ?? "",
    decisions: parsed.decisions ?? "",
  };
}
