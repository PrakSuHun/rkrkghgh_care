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
  if (!instruction) return NextResponse.json({ error: "instruction required" }, { status: 400 });

  const { data: intake, error } = await supabase.from("intake_forms").select("*").eq("id", id).maybeSingle();
  if (error || !intake) return NextResponse.json({ error: "초기상담기록지 없음" }, { status: 404 });

  const current = intake.extracted_data ?? {};
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });
  const prompt = `${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
아래 JSON 형식의 초기상담기록지를 사용자 지시에 따라 수정해라.
- 지시에서 언급 안 한 필드는 그대로 둬라.
- 지시에 해당하는 부분만 자연스럽게 고쳐라.
- 새로운 사실을 만들지 마라. 사용자가 구체적 수치·일정·이름을 지시하면 그대로 반영.
- 같은 JSON 스키마 그대로 출력. 다른 텍스트 금지.

[현재 초기상담기록지]
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

  const { error: upErr } = await supabase
    .from("intake_forms")
    .update({
      extracted_data: next,
      counseling_date: next.counseling_date ?? intake.counseling_date,
      counselor_name: next.counselor_name ?? intake.counselor_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ extracted: next });
}
