import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export async function generateCounselingBatch(opts: {
  topic: string;
  date: string;
  workers: Array<{ id: number; name: string }>;
}): Promise<Array<{ workerId: number; workerName: string; summary: string }>> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const prompt = `${NO_HALLUCINATION_RULES}
${PERSONA_WRITING_RULES}

재가장기요양센터에서 요양보호사 상담일지를 작성한다.
상담 주제: "${opts.topic}"
상담일: ${opts.date}

아래 요양보호사 ${opts.workers.length}명 각각에 대해, 같은 주제로 상담한 내용을 **사람마다 표현·문장이 약간씩 다르게** 작성한다.
각 상담일지는 3~5문장, 자연스러운 평어체. 내용이 반복되지 않게 문장 구조를 다양화.

요양보호사 목록:
${opts.workers.map((w) => `- ${w.name} (id: ${w.id})`).join("\n")}

JSON 배열로만 응답. 다른 텍스트 금지.
[
  {"worker_id": 숫자, "worker_name": "이름", "summary": "상담 내용 3~5문장"}
]`;

  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    throw new Error("AI JSON 파싱 실패");
  }
}
