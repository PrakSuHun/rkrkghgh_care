import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export type TranscribeKind = "journal" | "counseling";

export type NameContext = {
  /** 알려진 모든 사람 이름 (대상자 + 요양보호사) */
  knownNames: string[];
  /** 우선순위 후보 (이 녹음과 매칭된 사람들 — 더 가능성 높음) */
  preferredNames?: string[];
};

async function correctNames(text: string, ctx: NameContext): Promise<string> {
  if (!client || !text || ctx.knownNames.length === 0) return text;
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0 },
  });
  const prompt = `다음 한국어 받아쓴 글에서 사람 이름이 발음 인식 오류로 잘못 적힌 부분이 있다면, [후보 이름 목록]에서 음성적으로 가장 가까운 이름으로 교정하세요.

규칙:
- 후보에 음성적으로 가까운 이름이 명확히 있을 때만 교정. 애매하면 그대로 둠.
- [우선 후보]에 있는 이름이 의미상 맞으면 그쪽으로 교정 (이 녹음과 직접 관련된 사람들).
- 사람 이름이 아닌 단어는 절대 건드리지 마세요.
- 받아쓴 글의 다른 표현, 어순, 줄바꿈은 그대로 유지.
- 교정한 결과 텍스트만 출력. 설명·머리말·따옴표 금지.

[후보 이름 목록]
${ctx.knownNames.join(", ")}

[우선 후보]
${(ctx.preferredNames ?? []).join(", ") || "없음"}

[받아쓴 글]
${text}`;
  try {
    const res = await model.generateContent(prompt);
    const out = res.response.text().trim();
    return out || text;
  } catch {
    return text;
  }
}

export async function transcribeAndSummarize(
  audio: Buffer,
  mimeType: string,
  kind: TranscribeKind,
  nameContext?: NameContext
): Promise<{ transcript: string; summary: string }> {
  if (!client) throw new Error("GEMINI_API_KEY is not set");

  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: LOW_TEMP_GENERATION_CONFIG,
  });
  const audioPart = {
    inlineData: { data: audio.toString("base64"), mimeType },
  };

  const transcribeRes = await model.generateContent([
    {
      text: `다음 음성을 한국어로 **들리는 그대로** 받아적으세요.
- 들리지 않거나 알아들을 수 없는 부분은 [불분명] 으로 표기.
- 추측해서 채우지 마세요.
- 받아쓴 내용만 출력. 설명·머리말 금지.`,
    },
    audioPart,
  ]);
  let transcript = transcribeRes.response.text().trim();
  if (!transcript) {
    throw new Error("Gemini returned empty transcript (possibly blocked or silent audio)");
  }

  if (nameContext && nameContext.knownNames.length > 0) {
    transcript = await correctNames(transcript, nameContext);
  }

  // 받아쓴 글 → 자연스러운 일지로 다듬기
  const kindLabel = kind === "journal" ? "어르신 돌봄 일지" : "요양보호사 상담 일지";
  const polishRes = await model.generateContent([
    {
      text: `${NO_HALLUCINATION_RULES}\n\n${PERSONA_WRITING_RULES}\n\n다음은 ${kindLabel}을 음성으로 받아쓴 글입니다. 이걸 자연스러운 ${kindLabel}로 다듬어주세요.

다듬는 규칙:
- 말머리·필러("어", "음", "그러니까", "어떻게 보면" 등), 반복, 군더더기는 제거
- 같은 내용 두 번 말한 건 한 번으로 합치기
- 사실 관계는 절대 추가·삭제·왜곡 금지. 받아쓴 내용에 있는 정보만 사용
- 시간 순서나 주제별로 자연스럽게 정리. 너무 짧게 줄이지는 말고 본 내용은 다 살리기
- 결과 일지 본문만 출력. 머리말·설명·따옴표 금지.

[받아쓴 글]
${transcript}`,
    },
  ]);
  const polished = polishRes.response.text().trim() || transcript;

  // 요약 (3~5문장 핵심)
  const summaryPrompt =
    kind === "journal"
      ? "다음 어르신 돌봄 일지의 핵심을 3~5문장으로 요약하세요."
      : "다음 상담 일지의 핵심과 특이사항을 3~5문장으로 요약하세요.";
  const summaryRes = await model.generateContent([
    { text: `${NO_HALLUCINATION_RULES}\n\n${PERSONA_WRITING_RULES}\n\n${summaryPrompt}\n\n[일지 본문]\n${polished}` },
  ]);
  const summary = summaryRes.response.text().trim();
  if (!summary) {
    throw new Error("Gemini returned empty summary");
  }

  return { transcript: polished, summary };
}
