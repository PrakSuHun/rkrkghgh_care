import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export type TranscribeKind = "journal" | "counseling";

export async function transcribeAndSummarize(
  audio: Buffer,
  mimeType: string,
  kind: TranscribeKind
): Promise<{ transcript: string; summary: string }> {
  if (!client) throw new Error("GEMINI_API_KEY is not set");

  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  const audioPart = {
    inlineData: { data: audio.toString("base64"), mimeType },
  };

  const transcribeRes = await model.generateContent([
    { text: "다음 음성을 한국어로 그대로 받아적으세요. 받아쓴 내용만 출력하고 설명이나 머리말은 넣지 마세요." },
    audioPart,
  ]);
  const transcript = transcribeRes.response.text().trim();
  if (!transcript) {
    throw new Error("Gemini returned empty transcript (possibly blocked or silent audio)");
  }

  const summaryPrompt =
    kind === "journal"
      ? "다음은 요양보호사의 어르신 돌봄 일지입니다. 핵심 내용을 한국어로 3~5문장으로 요약하세요."
      : "다음은 사회복지사의 상담 기록입니다. 핵심 내용과 특이사항을 한국어로 3~5문장으로 요약하세요.";

  const summaryRes = await model.generateContent([
    { text: `${summaryPrompt}\n\n---\n${transcript}` },
  ]);
  const summary = summaryRes.response.text().trim();
  if (!summary) {
    throw new Error("Gemini returned empty summary");
  }

  return { transcript, summary };
}
