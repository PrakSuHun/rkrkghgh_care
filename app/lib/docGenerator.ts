import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "./supabase";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";
import { CENTER_INFO } from "./centerInfo";

export type DocType =
  | "needs_assessment"
  | "senior_handover"
  | "monthly_work_report";

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  needs_assessment: "욕구사정지",
  senior_handover: "수급자 인수인계서",
  monthly_work_report: "업무체계보고서",
};

export type DocSection = { label: string; text: string; type?: "text" | "table"; rows?: string[][]; headers?: string[] };
export type DocOutput = { title: string; subtitle?: string; meta: DocSection[]; sections: DocSection[]; signature?: boolean };

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

async function aiExpand(prompt: string): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: LOW_TEMP_GENERATION_CONFIG,
  });
  const res = await model.generateContent(prompt);
  return res.response.text().trim();
}

export async function refineDocument(doc: DocOutput, instruction: string): Promise<DocOutput> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { ...LOW_TEMP_GENERATION_CONFIG, responseMimeType: "application/json" },
  });
  const prompt = `${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
아래 JSON 형식의 서류를 사용자 지시에 따라 수정해. 지시에서 언급 안 한 부분은 그대로 두고, 지시에 해당하는 부분만 자연스럽게 고쳐.
새로운 사실을 만들어내지 마. 사용자가 구체적 수치·일정·이름을 지시하면 그대로 반영.
출력은 같은 JSON 스키마 그대로. 다른 텍스트 금지.

[현재 서류]
${JSON.stringify(doc, null, 2)}

[사용자 지시]
${instruction}

수정된 서류를 같은 스키마로 응답해.`;
  const res = await model.generateContent(prompt);
  const raw = res.response.text().trim();
  try {
    return JSON.parse(raw.replace(/^```json\s*/, "").replace(/```\s*$/, ""));
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("AI 응답 파싱 실패");
  }
}

const ASSESS_FIELDS = [
  ["assess_meal", "식사 및 영양상태"],
  ["assess_mobility", "보행"],
  ["assess_physical", "신체기능"],
  ["assess_excretion", "배뇨 배변기능"],
  ["assess_hygiene", "위생 관리"],
  ["assess_adl", "일상생활수행"],
  ["assess_cognition", "인지기능"],
  ["assess_behavior", "행동증상"],
  ["assess_family_env", "가족 및 생활환경"],
  ["assess_summary", "종합의견"],
] as const;

function monthRange(month: string | undefined) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("년월(YYYY-MM)이 필요합니다");
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start, end };
}

function requireSenior(s: any): asserts s {
  if (!s) throw new Error("어르신을 찾을 수 없습니다");
}
function requireWorker(w: any): asserts w {
  if (!w) throw new Error("요양보호사를 찾을 수 없습니다");
}

function safeParseJSON(raw: string): any {
  try { return JSON.parse(raw.replace(/^```json\s*/, "").replace(/```\s*$/, "")); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) { console.error("AI JSON parse failed:", e, raw.slice(0, 500)); } }
  throw new Error("AI 응답 파싱 실패 — 다시 시도해주세요");
}

async function loadSenior(id: number) {
  const { data } = await supabase.from("seniors").select("*").eq("id", id).maybeSingle();
  return data;
}
async function loadWorker(id: number) {
  const { data } = await supabase.from("caregivers").select("*").eq("id", id).maybeSingle();
  return data;
}
async function loadCaregivers(seniorId: number) {
  const { data } = await supabase
    .from("caregiver_assignments")
    .select("role, start_date, caregivers(name, phone)")
    .eq("senior_id", seniorId)
    .eq("status", "active");
  return data ?? [];
}

export async function generateDocument(
  type: DocType,
  params: { seniorId?: number; workerId?: number; month?: string; fromWorkerId?: number; toWorkerId?: number; userPrompt?: string; writer?: string },
): Promise<DocOutput> {
  switch (type) {
    case "needs_assessment": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      return {
        title: "욕구사정지",
        subtitle: s.name,
        meta: [
          { label: "성명", text: s.name },
          { label: "생년월일", text: s.birth_date ?? "-" },
          { label: "장기요양등급", text: s.grade ?? "-" },
          { label: "인정번호", text: s.long_term_care_id ?? "-" },
          { label: "작성일", text: (s.assess_updated_at ?? new Date().toISOString()).slice(0, 10) },
          { label: "작성자", text: `${CENTER_INFO.head} (사회복지사)` },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: ASSESS_FIELDS.map(([k, l], i) => ({ label: `${String(i + 1).padStart(2, "0")}. ${l}`, text: s[k] ?? "내용 없음" })),
        signature: true,
      };
    }

    case "senior_handover": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      const cgs = await loadCaregivers(s.id);
      const cgNames = cgs.map((c: any) => c.caregivers?.name).filter(Boolean).join(", ") || "미배정";
      const fromW = params.fromWorkerId ? await loadWorker(params.fromWorkerId) : null;
      const toW = params.toWorkerId ? await loadWorker(params.toWorkerId) : null;
      return {
        title: "수급자 인수인계서",
        subtitle: s!.name,
        meta: [
          { label: "성명", text: s!.name },
          { label: "생년월일", text: s!.birth_date ?? "-" },
          { label: "등급", text: s!.grade ?? "-" },
          { label: "인정번호", text: s!.long_term_care_id ?? "-" },
          { label: "주소", text: s!.address ?? "-" },
          { label: "보호자", text: `${s!.guardian_name ?? "-"} (${s!.guardian_relation ?? "-"}) ${s!.guardian_phone ?? ""}` },
          { label: "현 담당", text: cgNames },
          { label: "전임 요양사", text: fromW?.name ?? "-" },
          { label: "후임 요양사", text: toW?.name ?? "-" },
          { label: "작성일", text: new Date().toISOString().slice(0, 10) },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: [
          { label: "1. 주요 질환", text: (s!.major_diseases ?? []).join(", ") || "없음" },
          { label: "2. 복약 및 의료", text: s!.medications ?? "-" },
          { label: "3. 식사·영양 특이사항", text: s!.assess_meal ?? "-" },
          { label: "4. 보행·이동", text: s!.assess_mobility ?? "-" },
          { label: "5. 인지·행동", text: `${s!.assess_cognition ?? "-"}\n\n${s!.assess_behavior ?? "-"}` },
          { label: "6. 가족 관계 및 연락 요령", text: s!.assess_family_env ?? "-" },
          { label: "7. 주의사항 및 선호", text: s!.assess_summary ?? "-" },
        ],
        signature: true,
      };
    }

    case "monthly_work_report": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      const { start, end } = monthRange(params.month);

      const { data: assign } = await supabase
        .from("caregiver_assignments")
        .select("caregivers(name, phone)")
        .eq("senior_id", s!.id)
        .eq("status", "active");
      const workerNames = (assign ?? []).map((a: any) => a.caregivers?.name).filter(Boolean).join(", ") || "미배정";

      const { data: journals } = await supabase
        .from("journals")
        .select("created_at, duration, summary")
        .eq("senior_id", s!.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      const journalText = (journals ?? []).map((j: any) => `[${j.created_at.slice(0, 10)}] ${j.summary ?? ""}`).join("\n\n") || "(이달 일지 없음)";

      const userPrompt = params.userPrompt?.trim();
      const ai = await aiExpand(`${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
대상자 업무체계보고서를 작성한다. 아래 자료만 근거로 사실을 기술.

${userPrompt ? `[사용자 작성 지시]\n${userPrompt}\n` : ""}
대상자: ${s!.name} (${s!.grade ?? "등급-"})
담당 요양보호사: ${workerNames}
욕구사정 종합의견: ${s!.assess_summary ?? "없음"}
주요질환: ${(s!.major_diseases ?? []).join(", ") || "없음"}

이달 일지 요약:
${journalText}

JSON 스키마로만 응답:
{
  "state":"대상자 상태 5~8문장. 식사·보행·인지·행동·정서·건강 등 일지·욕구사정 근거로 구체적으로",
  "caregiver_action":"요양보호사 조치사항 3~5문장. 이달 제공한 돌봄 내용",
  "center_action":"센터 조치사항 2~4문장. 특별한 것 없으면 정기 모니터링 언급"
}`);
      const p = safeParseJSON(ai);
      const month = params.month!;
      const today = new Date().toISOString().slice(0, 10);

      return {
        title: "업무체계보고서",
        subtitle: `${s!.name} · ${month}`,
        meta: [
          { label: "_kind", text: "work_report" },
          { label: "senior_name", text: s!.name },
          { label: "grade", text: s!.grade ?? "-" },
          { label: "worker_name", text: workerNames },
          { label: "month", text: month },
          { label: "date", text: today },
          { label: "writer", text: params.writer || "권오성" },
          { label: "center", text: CENTER_INFO.name },
          { label: "state", text: p.state ?? "" },
          { label: "caregiver_action", text: p.caregiver_action ?? "" },
          { label: "center_action", text: p.center_action ?? "" },
        ],
        sections: [],
        signature: false,
      };
    }
  }
}
