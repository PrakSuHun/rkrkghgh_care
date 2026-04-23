import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export async function generateCounselingBatch(opts: {
  topic?: string;
  date: string;
  method?: string;
  counselor?: string;
  workers: Array<{ id: number; name: string; seniors?: Array<{ name: string; grade: string | null; summary: string | null }>; no_senior?: boolean }>;
  previousLogs?: Array<{ worker_name: string; senior_name?: string | null; summary: string; action: string; created_at: string }>;
}): Promise<Array<{ workerId: number; workerName: string; summary: string; action: string; prevResult: string }>> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const prevText = (opts.previousLogs ?? []).length > 0
    ? `\n[이전 상담 내역]\n${opts.previousLogs!.map((l) => {
        const tag = l.senior_name ? `[${l.senior_name}]` : "[일반상담]";
        return `- ${l.worker_name} ${tag} (${l.created_at}): 상담내용: ${l.summary} / 조치사항: ${l.action || "없음"}`;
      }).join("\n")}`
    : "\n(이전 상담 내역 없음)";

  const prompt = `${NO_HALLUCINATION_RULES}
${PERSONA_WRITING_RULES}

재가장기요양센터에서 요양보호사 상담일지를 작성한다.
${opts.topic ? `상담 주제: "${opts.topic}"` : ""}
상담일자: ${opts.date}
상담방법: ${opts.method ?? "대면"}
상담자명: ${opts.counselor || "박현식"}

${prevText}

아래 요양보호사 ${opts.workers.length}명 각각에 대해 상담일지를 작성한다.
각 상담일지에는 다음 3개 항목이 반드시 포함:

1. 상담내용: 요양보호사와의 상담 내용 5~8문장. **요양사 본인에게 포커스** — 업무 수행 태도, 근무 상황, 건의사항, 교육 참여, 애로사항, 본인 건강·컨디션 등이 중심. 어르신 이야기를 꺼내는 경우는 요양사의 담당 대상자 범위 내에서만, 간단히 1~2회 언급. 담당하지 않는 어르신 얘기를 만들지 말 것. 사람마다 표현·문장이 약간씩 다르게.
2. 조치사항: 상담 결과 필요한 조치 1~3문장. 특별한 조치가 없으면 "해당 없음".
3. 이전 조치사항 이행결과: 이전 상담에서 조치사항이 있었다면 그 이행 여부를 1~2문장으로 기술. 이전 상담이 없거나 조치사항이 없었으면 "해당 없음".

요양보호사별 담당 대상자 참고 (※ 사실 검증용 — 담당하지 않는 어르신 얘기를 지어내지 말 것):
${opts.workers.map((w) => {
  const srs = (w.seniors ?? []).map((s) => `  · ${s.name} (${s.grade ?? "등급-"})`).join("\n");
  if (w.no_senior) {
    return `- ${w.name} (id: ${w.id}) — **특정 어르신과 무관한 일반 상담** (교육·근무태도·컨디션·휴가 등 요양사 본인 중심으로 작성. 어르신 얘기 꺼내지 말 것)`;
  }
  return `- ${w.name} (id: ${w.id})\n${srs || "  (담당 대상자 없음 — 어르신 언급 금지)"}`;
}).join("\n\n")}

JSON 배열로만 응답. 다른 텍스트 금지.
[
  {
    "worker_id": 숫자,
    "worker_name": "이름",
    "summary": "상담내용 5~8문장",
    "action": "조치사항 (없으면 해당 없음)",
    "prev_result": "이전 조치사항 이행결과 (없으면 해당 없음)"
  }
]`;

  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned).map((r: any) => ({ ...r, prevResult: r.prev_result ?? r.prevResult ?? "해당 없음" }));
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]).map((r: any) => ({ ...r, prevResult: r.prev_result ?? r.prevResult ?? "해당 없음" }));
    throw new Error("AI JSON 파싱 실패");
  }
}
