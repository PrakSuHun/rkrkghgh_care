import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "@/lib/aiPolicy";

export const maxDuration = 120;

function getClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const instruction = String(body.instruction ?? "").trim();
  if (!instruction) return NextResponse.json({ error: "instruction 필요" }, { status: 400 });

  const { data: senior } = await supabase.from("seniors").select("needs_assessment_full").eq("id", id).maybeSingle();
  if (!senior?.needs_assessment_full) return NextResponse.json({ error: "욕구사정지 없음" }, { status: 404 });

  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const prompt = `${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
아래 JSON은 공단 욕구조사기록지다. 사용자 지시에 따라 수정해.
지시에서 언급 안 한 부분은 그대로 두고, 지시에 해당하는 부분만 자연스럽게 고쳐.
출력은 같은 JSON 스키마 그대로. 다른 텍스트 금지.

[현재 욕구조사기록지]
${JSON.stringify(senior.needs_assessment_full, null, 2)}

[사용자 지시]
${instruction}

수정된 JSON만 응답.`;

  try {
    const res = await model.generateContent(prompt);
    const raw = res.response.text().trim().replace(/^```json\s*/, "").replace(/```\s*$/, "");
    let parsed;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error("파싱 실패"); }

    await supabase.from("seniors").update({ needs_assessment_full: parsed, needs_assessment_updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ data: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
