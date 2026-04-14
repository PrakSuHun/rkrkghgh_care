import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "./supabase";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";
import { CENTER_INFO } from "./centerInfo";

export type DocType =
  | "needs_assessment"
  | "care_plan"
  | "monthly_status"
  | "service_record"
  | "senior_handover"
  | "monthly_counseling"
  | "service_contract"
  | "monthly_work_report";

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  needs_assessment: "욕구사정지",
  care_plan: "급여제공계획서",
  monthly_status: "상태기록지(월간)",
  service_record: "급여제공기록지",
  senior_handover: "수급자 인수인계서",
  monthly_counseling: "상담일지 월간보고",
  service_contract: "서비스제공 계약서",
  monthly_work_report: "월간 업무보고서",
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
    model: "gemini-2.5-pro",
    generationConfig: LOW_TEMP_GENERATION_CONFIG,
  });
  const res = await model.generateContent(prompt);
  return res.response.text().trim();
}

export async function refineDocument(doc: DocOutput, instruction: string): Promise<DocOutput> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-pro",
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
  params: { seniorId?: number; workerId?: number; month?: string; fromWorkerId?: number; toWorkerId?: number },
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

    case "care_plan": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      const cgs = await loadCaregivers(s.id);
      const cgNames = cgs.map((c: any) => c.caregivers?.name).filter(Boolean).join(", ") || "미배정";
      const assessText = ASSESS_FIELDS.map(([k, l]) => `${l}: ${s[k] ?? "-"}`).join("\n");
      const ai = await aiExpand(`${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
재가장기요양 급여제공계획서를 공단 표준 서식에 맞춰 작성하세요. 다른 텍스트 절대 금지.
아래 JSON 스키마로만 응답.
{
  "user_needs":"수급자 및 가족의 요구 — 욕구사정과 가족환경을 근거로 3~4문장",
  "long_term_goal":"장기 목표(6개월) — 1~2문장",
  "short_term_goal":"단기 목표(3개월) — 1~2문장",
  "service_contents":"급여제공 내용 — 방문요양 주당 횟수와 1회 시간, 신체활동/가사지원 등 구체",
  "care_method":"급여제공 방법과 수행 시 유의사항",
  "monitoring":"모니터링 및 재평가 — 평가주기와 지표",
  "emergency":"긴급상황 대응 — 낙상/응급/의식저하 시 절차"
}
대상자: ${s.name} / 등급: ${s.grade ?? "-"} / 인정번호: ${s.long_term_care_id ?? "-"}
주요질환: ${(s.major_diseases ?? []).join(", ") || "없음"}
담당 요양사: ${cgNames}
욕구사정 요약:
${assessText}
위 데이터 근거로만 작성. 없는 사실 창작 금지.`);
      const p = safeParseJSON(ai);
      const today = new Date().toISOString().slice(0, 10);
      const planEnd = new Date(); planEnd.setMonth(planEnd.getMonth() + 6);
      return {
        title: "장기요양급여 제공계획서",
        subtitle: s.name,
        meta: [
          { label: "성명", text: s.name },
          { label: "생년월일", text: s.birth_date ?? "-" },
          { label: "등급", text: s.grade ?? "-" },
          { label: "인정번호", text: s.long_term_care_id ?? "-" },
          { label: "급여종류", text: "방문요양" },
          { label: "계획기간", text: `${today} ~ ${planEnd.toISOString().slice(0, 10)}` },
          { label: "담당 요양보호사", text: cgNames },
          { label: "작성일", text: today },
          { label: "작성자", text: `${CENTER_INFO.head} (사회복지사)` },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: [
          { label: "1. 수급자 및 가족의 요구", text: p.user_needs ?? "" },
          { label: "2. 장기요양 장기목표 (6개월)", text: p.long_term_goal ?? "" },
          { label: "3. 장기요양 단기목표 (3개월)", text: p.short_term_goal ?? "" },
          { label: "4. 급여제공 내용", text: p.service_contents ?? "" },
          { label: "5. 급여제공 방법 및 유의사항", text: p.care_method ?? "" },
          { label: "6. 모니터링 및 재평가", text: p.monitoring ?? "" },
          { label: "7. 긴급상황 대응", text: p.emergency ?? "" },
        ],
        signature: true,
      };
    }

    case "monthly_status": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      const { start, end } = monthRange(params.month);
      const { data: journals } = await supabase
        .from("journals")
        .select("created_at, summary, transcript")
        .eq("senior_id", s!.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      const list = (journals ?? []).map((j: any) => `[${j.created_at.slice(0, 10)}] ${j.summary ?? ""}`).join("\n\n");
      const ai = await aiExpand(`${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
이 어르신의 ${params.month} 월간 상태기록지를 작성. 입력된 일지들에서 확인된 내용만 반영.
대상: ${s!.name}
일지 목록:
${list || "(이달 일지 없음)"}
JSON 스키마로만 응답:
{
  "overall":"이달 전반 상태 요약 3~4문장",
  "body":"신체 상태 변화 — 기능·질환 관련 변동",
  "mind":"정서·인지 상태 — 기분·인지기능",
  "family":"가족·환경 변화",
  "issues":"특이사항 및 이슈",
  "next":"다음달 돌봄 방향"
}`);
      const p = safeParseJSON(ai);
      return {
        title: "월간 상태기록지",
        subtitle: `${s!.name} · ${params.month}`,
        meta: [
          { label: "성명", text: s!.name },
          { label: "등급", text: s!.grade ?? "-" },
          { label: "기간", text: `${params.month}` },
          { label: "일지 건수", text: `${(journals ?? []).length}건` },
          { label: "작성일", text: new Date().toISOString().slice(0, 10) },
          { label: "작성자", text: `${CENTER_INFO.head} (사회복지사)` },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: [
          { label: "1. 전반 상태", text: p.overall ?? "" },
          { label: "2. 신체 상태 변화", text: p.body ?? "" },
          { label: "3. 정서·인지 상태", text: p.mind ?? "" },
          { label: "4. 가족·환경 변화", text: p.family ?? "" },
          { label: "5. 특이사항 및 이슈", text: p.issues ?? "" },
          { label: "6. 다음달 돌봄 방향", text: p.next ?? "" },
        ],
        signature: true,
      };
    }

    case "service_record": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      const { start, end } = monthRange(params.month);
      const { data: journals } = await supabase
        .from("journals")
        .select("created_at, duration, summary, caregiver_id, caregivers:caregiver_id(name)")
        .eq("senior_id", s!.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      const rows = (journals ?? []).map((j: any) => [
        j.created_at.slice(0, 10),
        `${Math.round((j.duration ?? 0) / 60)}분`,
        j.caregivers?.name ?? "-",
        (j.summary ?? "-").slice(0, 120),
      ]);
      const totalMin = (journals ?? []).reduce((s: number, j: any) => s + (j.duration ?? 0) / 60, 0);
      return {
        title: "급여제공기록지",
        subtitle: `${s!.name} · ${params.month}`,
        meta: [
          { label: "성명", text: s!.name },
          { label: "등급", text: s!.grade ?? "-" },
          { label: "인정번호", text: s!.long_term_care_id ?? "-" },
          { label: "급여종류", text: "방문요양" },
          { label: "기간", text: params.month! },
          { label: "총 건수", text: `${rows.length}건` },
          { label: "총 제공시간", text: `${Math.round(totalMin)}분` },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: [
          {
            label: "일자별 제공 기록",
            text: "",
            type: "table",
            headers: ["일자", "제공시간", "요양보호사", "서비스 요약"],
            rows: rows.length ? rows : [["-", "-", "-", "기록 없음"]],
          },
        ],
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

    case "monthly_counseling": {
      const w = await loadWorker(params.workerId!);
      requireWorker(w);
      const { start, end } = monthRange(params.month);
      const { data: logs } = await supabase
        .from("counseling_logs")
        .select("created_at, duration, summary, transcript")
        .eq("caregiver_id", w!.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      const list = (logs ?? []).map((l: any) => `[${l.created_at.slice(0, 10)}] ${l.summary ?? ""}`).join("\n\n");
      const ai = await aiExpand(`${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
요양사 월간 상담일지 보고서를 작성. 입력된 상담만 반영.
요양사: ${w!.name}
상담들:
${list || "(이달 상담 없음)"}
JSON 스키마로만 응답:
{
  "overall":"이달 전반 상담 요약",
  "seniors":"담당 어르신별 특이사항 — 어르신명으로 묶어 줄글",
  "complaints":"요양사 건의·호소",
  "actions":"센터 조치사항",
  "followup":"다음달 계획"
}`);
      const p = safeParseJSON(ai);
      return {
        title: "상담일지 월간보고",
        subtitle: `${w!.name} · ${params.month}`,
        meta: [
          { label: "요양보호사", text: w!.name },
          { label: "직종", text: w!.job_type ?? "요양보호사" },
          { label: "기간", text: params.month! },
          { label: "상담 건수", text: `${(logs ?? []).length}건` },
          { label: "작성일", text: new Date().toISOString().slice(0, 10) },
          { label: "작성자", text: `${CENTER_INFO.head} (사회복지사)` },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: [
          { label: "1. 전반 요약", text: p.overall ?? "" },
          { label: "2. 담당 어르신별 특이사항", text: p.seniors ?? "" },
          { label: "3. 요양사 건의·호소", text: p.complaints ?? "" },
          { label: "4. 센터 조치사항", text: p.actions ?? "" },
          { label: "5. 다음달 계획", text: p.followup ?? "" },
        ],
        signature: true,
      };
    }

    case "service_contract": {
      const s = await loadSenior(params.seniorId!);
      requireSenior(s);
      const cgs = await loadCaregivers(s.id);
      const primary = cgs[0]?.caregivers as any;
      return {
        title: "장기요양급여 이용계약서",
        subtitle: `${s!.name} · ${CENTER_INFO.name}`,
        meta: [
          { label: "수급자 성명", text: s!.name },
          { label: "생년월일", text: s!.birth_date ?? "-" },
          { label: "주소", text: s!.address ?? "-" },
          { label: "등급", text: s!.grade ?? "-" },
          { label: "인정번호", text: s!.long_term_care_id ?? "-" },
          { label: "본인부담률", text: `${s!.copay_rate ?? "-"}%` },
          { label: "보호자 성명", text: s!.guardian_name ?? "-" },
          { label: "보호자 관계", text: s!.guardian_relation ?? "-" },
          { label: "보호자 연락처", text: s!.guardian_phone ?? "-" },
          { label: "기관명", text: CENTER_INFO.name },
          { label: "기관주소", text: CENTER_INFO.address },
          { label: "기관장", text: CENTER_INFO.head },
          { label: "기관 연락처", text: CENTER_INFO.phone },
          { label: "담당 요양보호사", text: primary ? `${primary.name} ${primary.phone ?? ""}` : "미배정" },
          { label: "계약일", text: new Date().toISOString().slice(0, 10) },
        ],
        sections: [
          { label: "제1조 (목적)", text: "이 계약은 노인장기요양보험법에 따라 장기요양기관이 수급자에게 재가급여를 제공함에 있어 필요한 사항을 정함을 목적으로 함." },
          { label: "제2조 (서비스 내용)", text: "기관은 수급자의 욕구사정 결과에 따라 방문요양을 제공함. 신체활동 지원, 가사 및 일상생활 지원, 개인활동 지원, 정서지원 등을 포함함." },
          { label: "제3조 (계약기간)", text: "계약기간은 장기요양인정 유효기간 이내로 하며, 상호 서면 합의에 따라 연장할 수 있음." },
          { label: "제4조 (서비스 제공 요일 및 시간)", text: "수급자의 월 한도액 범위에서 요일과 시간을 정하며, 변경이 필요한 경우 상호 협의하여 조정함." },
          { label: "제5조 (월 이용한도액 및 본인부담금)", text: `등급별 월 한도액 범위 내에서 서비스를 제공하며, 본인부담금은 수급자의 부담구분에 따라 결정됨. 본 수급자의 본인부담률은 ${s!.copay_rate ?? "-"}%임.` },
          { label: "제6조 (본인부담금 납부)", text: "본인부담금은 매월 정산하여 고지하며, 수급자 또는 보호자가 기관이 지정한 방법으로 납부함." },
          { label: "제7조 (기관의 의무)", text: "기관은 서비스의 질을 보장하고, 수급자의 인권과 사생활을 존중하며, 사고 발생 시 즉시 보호자에게 통보함." },
          { label: "제8조 (수급자의 의무)", text: "수급자 및 보호자는 서비스 제공에 필요한 정보를 성실히 제공하고, 요양보호사의 안전한 서비스 제공에 협조함." },
          { label: "제9조 (서비스의 변경·중단·해지)", text: "당사자 일방이 계약 내용을 변경하거나 해지하고자 하는 경우 서면으로 사전 통지함. 다만 긴급한 사유가 있는 경우 예외로 함." },
          { label: "제10조 (개인정보 보호)", text: "기관은 수급자의 개인정보를 개인정보보호법에 따라 보호하며, 업무 목적 외로 이용하지 아니함." },
          { label: "제11조 (고충처리)", text: "서비스와 관련한 고충은 기관에 서면 또는 구두로 제기할 수 있으며, 기관은 접수일로부터 7일 이내에 조치 결과를 통보함." },
          { label: "제12조 (기타)", text: "이 계약에 명시되지 않은 사항은 노인장기요양보험법 및 관련 법령, 상호 협의에 따름." },
        ],
        signature: true,
      };
    }

    case "monthly_work_report": {
      const w = await loadWorker(params.workerId!);
      requireWorker(w);
      const { start, end } = monthRange(params.month);
      const { data: assign } = await supabase
        .from("caregiver_assignments")
        .select("senior_id, seniors(name, grade)")
        .eq("caregiver_id", w!.id)
        .eq("status", "active");
      const seniorIds = (assign ?? []).map((a: any) => a.senior_id);
      const { data: journals } = seniorIds.length
        ? await supabase
            .from("journals")
            .select("senior_id, created_at, duration, summary")
            .in("senior_id", seniorIds)
            .gte("created_at", start)
            .lt("created_at", end)
            .order("created_at")
        : { data: [] as any[] };
      const byS = new Map<number, { name: string; grade: string | null; entries: string[]; minutes: number }>();
      for (const a of assign ?? []) byS.set(a.senior_id, { name: (a as any).seniors?.name ?? "-", grade: (a as any).seniors?.grade ?? null, entries: [], minutes: 0 });
      for (const j of journals ?? []) {
        const min = Math.round((j.duration ?? 0) / 60);
        const entry = `[${j.created_at.slice(0, 10)}] ${min}분 · ${j.summary ?? "-"}`;
        const b = byS.get(j.senior_id);
        if (b) { b.entries.push(entry); b.minutes += min; }
      }
      const totalMin = Array.from(byS.values()).reduce((s, v) => s + v.minutes, 0);
      const sections: DocSection[] = Array.from(byS.values()).map((v) => ({
        label: `${v.name} (${v.grade ?? "등급-"}) · ${v.entries.length}회 · ${v.minutes}분`,
        text: v.entries.length ? v.entries.join("\n\n") : "이달 제공 기록 없음",
      }));
      return {
        title: "월간 업무보고서",
        subtitle: `${w!.name} · ${params.month}`,
        meta: [
          { label: "요양보호사", text: w!.name },
          { label: "직종", text: w!.job_type ?? "요양보호사" },
          { label: "기간", text: params.month! },
          { label: "담당 대상자", text: `${seniorIds.length}명` },
          { label: "총 방문", text: `${(journals ?? []).length}회` },
          { label: "총 제공시간", text: `${totalMin}분` },
          { label: "작성일", text: new Date().toISOString().slice(0, 10) },
          { label: "기관명", text: CENTER_INFO.name },
        ],
        sections: sections.length ? sections : [{ label: "-", text: "담당 배정이 없습니다." }],
        signature: true,
      };
    }
  }
}
