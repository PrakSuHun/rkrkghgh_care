import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NO_HALLUCINATION_RULES, LOW_TEMP_GENERATION_CONFIG } from "@/lib/aiPolicy";
import { interpret } from "@/lib/fallAssessor";

export const maxDuration = 60;

function getClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const instruction = String(body.instruction ?? "").trim();
  if (!instruction) return NextResponse.json({ error: "instruction 필요" }, { status: 400 });

  const { data: fa } = await supabase.from("fall_assessments").select("*").eq("id", id).maybeSingle();
  if (!fa) return NextResponse.json({ error: "낙상평가 없음" }, { status: 404 });

  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const prompt = `${NO_HALLUCINATION_RULES}
아래 낙상평가(Huhn 척도) 데이터를 사용자 지시에 따라 수정해.
점수는 허용값만 사용: age(0,1,2,3) mental(0,2,4) bowel(0,1,3,4) fall_history(0,2,4) activity(0,1,3,4) gait(0,2,3,4) medication(0,2,3,4). 정상=0.

[현재 데이터]
scores: ${JSON.stringify(fa.scores)}
total: ${fa.total}
notes: ${fa.notes ?? ""}

[사용자 지시]
${instruction}

아래 JSON만 응답:
{"scores":{"age":N,"mental":N,"bowel":N,"fall_history":N,"activity":N,"gait":N,"medication":N},"notes":"수정된 특이사항"}`;

  try {
    const res = await model.generateContent(prompt);
    const raw = res.response.text().trim().replace(/^```json\s*/, "").replace(/```\s*$/, "");
    let parsed;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error("파싱 실패"); }

    const total = Object.values(parsed.scores as Record<string, number>).reduce((s, v) => s + Number(v || 0), 0);
    await supabase.from("fall_assessments").update({
      scores: parsed.scores, total, interpretation: interpret(total),
      notes: parsed.notes ?? fa.notes, updated_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json({ scores: parsed.scores, total, interpretation: interpret(total), notes: parsed.notes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
