import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "./supabase";
import { NO_HALLUCINATION_RULES, PERSONA_WRITING_RULES, LOW_TEMP_GENERATION_CONFIG } from "./aiPolicy";

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

export type DocSection = { label: string; text: string };
export type DocOutput = { title: string; subtitle?: string; meta: DocSection[]; sections: DocSection[] };

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

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start, end };
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
  params: { seniorId?: number; workerId?: number; month?: string },
): Promise<DocOutput> {
  switch (type) {
    case "needs_assessment": {
      const s = await loadSenior(params.seniorId!);
      if (!s) throw new Error("어르신 없음");
      return {
        title: "욕구사정지",
        subtitle: s.name,
        meta: [
          { label: "성명", text: s.name },
          { label: "생년월일", text: s.birth_date ?? "-" },
          { label: "장기요양등급", text: s.grade ?? "-" },
          { label: "인정번호", text: s.long_term_care_id ?? "-" },
          { label: "작성일", text: (s.assess_updated_at ?? new Date().toISOString()).slice(0, 10) },
        ],
        sections: ASSESS_FIELDS.map(([k, l]) => ({ label: l, text: s[k] ?? "내용 없음" })),
      };
    }

    case "care_plan": {
      const s = await loadSenior(params.seniorId!);
      if (!s) throw new Error("어르신 없음");
      const cgs = await loadCaregivers(s.id);
      const cgNames = cgs.map((c: any) => c.caregivers?.name).filter(Boolean).join(", ") || "미배정";
      const assessText = ASSESS_FIELDS.map(([k, l]) => `${l}: ${s[k] ?? "-"}`).join("\n");
      const ai = await aiExpand(`${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
재가장기요양 급여제공계획서를 아래 JSON 스키마로 작성하세요. 다른 텍스트 절대 금지.
{"service_goals":"서비스 목표 3~4줄","service_plan":"제공할 급여 종류와 빈도, 시간","care_method":"수행 방법과 유의사항","monitoring":"모니터링 및 재평가 계획"}
대상자: ${s.name} / 등급: ${s.grade ?? "-"} / 인정번호: ${s.long_term_care_id ?? "-"}
주요질환: ${(s.major_diseases ?? []).join(", ") || "없음"}
담당 요양사: ${cgNames}
욕구사정 요약:
${assessText}
위 데이터 근거로만 작성. 없는 사실 창작 금지.`);
      let p: any = {}; try { p = JSON.parse(ai.replace(/^```json\s*/, "").replace(/```\s*$/, "")); } catch {}
      return {
        title: "급여제공계획서",
        subtitle: s.name,
        meta: [
          { label: "대상자", text: s.name },
          { label: "등급", text: s.grade ?? "-" },
          { label: "인정번호", text: s.long_term_care_id ?? "-" },
          { label: "담당 요양보호사", text: cgNames },
          { label: "작성일", text: new Date().toISOString().slice(0, 10) },
        ],
        sections: [
          { label: "서비스 목표", text: p.service_goals ?? "" },
          { label: "급여 제공 계획", text: p.service_plan ?? "" },
          { label: "수행 방법 및 유의사항", text: p.care_method ?? "" },
          { label: "모니터링 및 재평가", text: p.monitoring ?? "" },
        ],
      };
    }

    case "monthly_status": {
      const s = await loadSenior(params.seniorId!);
      const { start, end } = monthRange(params.month!);
      const { data: journals } = await supabase
        .from("journals")
        .select("created_at, summary, transcript")
        .eq("senior_id", s!.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      const list = (journals ?? []).map((j: any) => `[${j.created_at.slice(0, 10)}] ${j.summary ?? ""}`).join("\n\n");
      const ai = await aiExpand(`${NO_HALLUCINATION_RULES}\n${PERSONA_WRITING_RULES}
이 어르신의 ${params.month} 월간 상태기록지를 작성하세요. 입력된 일지들에서 확인된 내용만 반영.
대상: ${s!.name}
일지 목록:
${list || "(이달 일지 없음)"}
아래 JSON 스키마로만 응답:
{"overall":"이달 전반 상태 요약 3~4줄","changes":"전달 대비 변화점","issues":"특이사항 및 이슈","next":"다음달 돌봄 방향"}`);
      let p: any = {}; try { p = JSON.parse(ai.replace(/^```json\s*/, "").replace(/```\s*$/, "")); } catch {}
      return {
        title: "월간 상태기록지",
        subtitle: `${s!.name} · ${params.month}`,
        meta: [
          { label: "대상자", text: s!.name },
          { label: "기간", text: `${params.month}` },
          { label: "일지 건수", text: `${(journals ?? []).length}건` },
        ],
        sections: [
          { label: "전반 상태", text: p.overall ?? "" },
          { label: "변화점", text: p.changes ?? "" },
          { label: "특이사항", text: p.issues ?? "" },
          { label: "다음달 방향", text: p.next ?? "" },
        ],
      };
    }

    case "service_record": {
      const s = await loadSenior(params.seniorId!);
      const { start, end } = monthRange(params.month!);
      const { data: journals } = await supabase
        .from("journals")
        .select("created_at, duration, summary")
        .eq("senior_id", s!.id)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at");
      const sections = (journals ?? []).map((j: any) => ({
        label: j.created_at.slice(0, 10),
        text: `${Math.round((j.duration ?? 0) / 60)}분 · ${j.summary ?? "-"}`,
      }));
      return {
        title: "급여제공기록지",
        subtitle: `${s!.name} · ${params.month}`,
        meta: [
          { label: "대상자", text: s!.name },
          { label: "기간", text: params.month! },
          { label: "총 건수", text: `${sections.length}건` },
        ],
        sections: sections.length ? sections : [{ label: "-", text: "기록 없음" }],
      };
    }

    case "senior_handover": {
      const s = await loadSenior(params.seniorId!);
      const cgs = await loadCaregivers(s!.id);
      const cgNames = cgs.map((c: any) => c.caregivers?.name).filter(Boolean).join(", ") || "미배정";
      return {
        title: "수급자 인수인계서",
        subtitle: s!.name,
        meta: [
          { label: "성명", text: s!.name },
          { label: "등급", text: s!.grade ?? "-" },
          { label: "인정번호", text: s!.long_term_care_id ?? "-" },
          { label: "주소", text: s!.address ?? "-" },
          { label: "보호자", text: `${s!.guardian_name ?? "-"} (${s!.guardian_relation ?? "-"}) ${s!.guardian_phone ?? ""}` },
          { label: "현 담당 요양사", text: cgNames },
          { label: "작성일", text: new Date().toISOString().slice(0, 10) },
        ],
        sections: [
          { label: "주요 질환", text: (s!.major_diseases ?? []).join(", ") || "없음" },
          { label: "종합의견", text: s!.assess_summary ?? "-" },
          { label: "식사 및 영양", text: s!.assess_meal ?? "-" },
          { label: "보행", text: s!.assess_mobility ?? "-" },
          { label: "인지기능", text: s!.assess_cognition ?? "-" },
          { label: "행동증상", text: s!.assess_behavior ?? "-" },
        ],
      };
    }

    case "monthly_counseling": {
      const w = await loadWorker(params.workerId!);
      const { start, end } = monthRange(params.month!);
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
{"overall":"이달 전반 상담 요약","issues":"특이사항/건의사항","followup":"다음달 조치"}`);
      let p: any = {}; try { p = JSON.parse(ai.replace(/^```json\s*/, "").replace(/```\s*$/, "")); } catch {}
      return {
        title: "상담일지 월간보고",
        subtitle: `${w!.name} · ${params.month}`,
        meta: [
          { label: "요양보호사", text: w!.name },
          { label: "기간", text: params.month! },
          { label: "상담 건수", text: `${(logs ?? []).length}건` },
        ],
        sections: [
          { label: "전반 요약", text: p.overall ?? "" },
          { label: "특이사항 및 건의", text: p.issues ?? "" },
          { label: "다음달 조치", text: p.followup ?? "" },
        ],
      };
    }

    case "service_contract": {
      const s = await loadSenior(params.seniorId!);
      const cgs = await loadCaregivers(s!.id);
      const primary = cgs[0]?.caregivers as any;
      return {
        title: "서비스제공 계약서",
        subtitle: `${s!.name} - ${primary?.name ?? "담당 미정"}`,
        meta: [
          { label: "수급자", text: `${s!.name} (${s!.grade ?? "-"})` },
          { label: "인정번호", text: s!.long_term_care_id ?? "-" },
          { label: "주보호자", text: `${s!.guardian_name ?? "-"} ${s!.guardian_phone ?? ""}` },
          { label: "주담당 요양보호사", text: primary ? `${primary.name} ${primary.phone ?? ""}` : "미배정" },
          { label: "계약일", text: new Date().toISOString().slice(0, 10) },
        ],
        sections: [
          { label: "제1조 목적", text: "본 계약은 노인장기요양보험법에 따라 수급자에게 재가급여를 제공하기 위한 서비스 제공 계약을 체결함을 목적으로 함." },
          { label: "제2조 서비스 내용", text: "방문요양, 신체활동 지원, 가사 및 일상생활 지원 등 어르신의 욕구사정 결과에 따라 제공함." },
          { label: "제3조 계약기간", text: "장기요양인정 유효기간 내에서 상호 합의된 기간 동안 계약 효력을 유지함." },
          { label: "제4조 서비스 제공 시간", text: "수급자의 요구와 등급에 따른 월 한도액 범위에서 합의된 요일과 시간에 제공함." },
          { label: "제5조 본인부담금", text: `등급 및 부담구분에 따른 법정 비율을 적용하며, 해당 수급자의 본인부담률은 ${s!.copay_rate ?? "-"}%로 함.` },
          { label: "제6조 권리와 의무", text: "센터는 서비스의 질을 보장하며 어르신의 인권과 사생활을 존중함. 수급자 및 보호자는 서비스 제공에 필요한 정보를 성실히 제공함." },
          { label: "제7조 기타", text: "본 계약에 명시되지 않은 사항은 관련 법령과 상호 협의에 따름." },
        ],
      };
    }

    case "monthly_work_report": {
      const w = await loadWorker(params.workerId!);
      const { start, end } = monthRange(params.month!);
      const { data: assign } = await supabase
        .from("caregiver_assignments")
        .select("senior_id, seniors(name)")
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
      const byS = new Map<number, { name: string; entries: string[] }>();
      for (const a of assign ?? []) byS.set(a.senior_id, { name: (a as any).seniors?.name ?? "-", entries: [] });
      for (const j of journals ?? []) {
        const entry = `[${j.created_at.slice(0, 10)}] ${Math.round((j.duration ?? 0) / 60)}분 · ${j.summary ?? "-"}`;
        byS.get(j.senior_id)?.entries.push(entry);
      }
      const sections: DocSection[] = Array.from(byS.values()).map((v) => ({
        label: v.name,
        text: v.entries.length ? v.entries.join("\n\n") : "이달 제공 기록 없음",
      }));
      return {
        title: "월간 업무보고서",
        subtitle: `${w!.name} · ${params.month}`,
        meta: [
          { label: "요양보호사", text: w!.name },
          { label: "기간", text: params.month! },
          { label: "담당 대상자", text: `${seniorIds.length}명` },
          { label: "총 방문", text: `${(journals ?? []).length}회` },
        ],
        sections: sections.length ? sections : [{ label: "-", text: "담당 배정이 없습니다." }],
      };
    }
  }
}
