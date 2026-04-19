import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "@/lib/aiPolicy";

export const maxDuration = 120;

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const instruction = String(body.instruction ?? "").trim();
  const current = body.current ?? {};
  if (!instruction) return NextResponse.json({ error: "instruction required" }, { status: 400 });

  const { data: senior } = await supabase.from("seniors").select("*").eq("id", id).maybeSingle();
  if (!senior) return NextResponse.json({ error: "대상자 없음" }, { status: 404 });

  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });
  const prompt = `${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
아래 JSON 은 재가노인복지센터의 '업무 인계·인수 확인서' 데이터다.
사용자 지시에 따라 수정해라.
- 지시에서 언급 안 한 필드는 그대로 둬라.
- 지시에 해당하는 부분만 자연스럽게 고쳐라.
- 새로운 사실을 만들지 마라. 사용자가 구체적 수치·일정·이름을 지시하면 그대로 반영.
- 내용은 A4 1페이지에 담길 수 있도록 간결하게 유지해라 (특히 disease_note, service_note, life_environment_note 는 2~3문장 이내).
- 같은 JSON 스키마 그대로 출력. 다른 텍스트 금지.

스키마 필드: recipient_name, birth_date, phone, guardian_name, address, service_body(배열), service_housework(배열), service_emotion(배열), service_note, disease_note, dementia_yes(true|false|null), dementia_level(상|중|하|""), dementia_symptom, medication_yes(true|false|null), medication_count, medication_list, life_environment_note, handover_date, handover_reason, from_worker, to_worker, from_worker_id, to_worker_id

[현재 인수인계서]
${JSON.stringify(current, null, 2)}

[사용자 지시]
${instruction}
`;
  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "");
  let next: any;
  try {
    next = JSON.parse(cleaned);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "AI JSON 파싱 실패" }, { status: 500 });
    next = JSON.parse(m[0]);
  }

  return NextResponse.json({ handover_data: next });
}
