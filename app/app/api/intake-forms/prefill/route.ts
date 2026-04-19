import { NextResponse } from "next/server";

type Field = {
  key: string;
  label: string;
  group: string;
  type: "text" | "number" | "textarea" | "select" | "boolean";
  options?: string[];
  placeholder?: string;
  question?: string;
};

const FIELDS: Field[] = [
  { key: "name", label: "수급자 성명", group: "기본사항", type: "text", question: "어르신 성명은 어떻게 되시나요?" },
  { key: "gender", label: "성별", group: "기본사항", type: "select", options: ["M", "F"], question: "성별은 (남/여)?" },
  { key: "birth_date", label: "생년월일", group: "기본사항", type: "text", placeholder: "YYYY-MM-DD", question: "생년월일은?" },
  { key: "grade", label: "장기요양등급", group: "기본사항", type: "text", placeholder: "예: 4등급", question: "장기요양등급은?" },
  { key: "blood_type", label: "혈액형", group: "기본사항", type: "text", question: "혈액형은?" },
  { key: "hometown", label: "고향", group: "기본사항", type: "text", question: "고향은 어디세요?" },
  { key: "economic_status", label: "경제상태", group: "기본사항", type: "select", options: ["일반", "경감", "기초"], question: "경제상태 분류는?" },
  { key: "height_cm", label: "키(cm)", group: "기본사항", type: "number", question: "키는 몇 cm이신가요?" },
  { key: "weight_kg", label: "체중(kg)", group: "기본사항", type: "number", question: "체중은 몇 kg이신가요?" },
  { key: "spouse", label: "배우자 유무", group: "기본사항", type: "boolean", question: "배우자는 계신가요?" },

  { key: "guardian_name", label: "보호자 성명", group: "보호자", type: "text", question: "보호자(주 연락자) 성명은?" },
  { key: "guardian_relation", label: "보호자 관계", group: "보호자", type: "text", placeholder: "예: 큰아들, 둘째 딸", question: "보호자와 어르신의 관계는?" },
  { key: "guardian_phone", label: "보호자 연락처", group: "보호자", type: "text", question: "보호자 연락처는?" },
  { key: "num_children", label: "자녀수", group: "보호자", type: "text", placeholder: "예: 2남 1녀", question: "자녀는 몇 분이세요?" },
  { key: "cohabit_type", label: "동거여부", group: "보호자", type: "select", options: ["유", "무", "왕래"], question: "보호자와 동거/왕래 여부는?" },
  { key: "cohabit", label: "동거/왕래 부연", group: "보호자", type: "text", placeholder: "예: 주1~2회", question: "동거 형태나 왕래 빈도 상세?" },

  { key: "walking", label: "보행", group: "일상생활", type: "select", options: ["자립", "도움", "완전도움"], question: "보행은 (자립/도움/완전도움)?" },
  { key: "eating", label: "식사 수행", group: "일상생활", type: "select", options: ["자립", "도움", "완전도움"], question: "식사 동작은?" },
  { key: "toilet", label: "용변", group: "일상생활", type: "select", options: ["자립", "도움", "완전도움(기저귀)"], question: "용변은?" },
  { key: "emotion", label: "정서", group: "일상생활", type: "select", options: ["안정됨", "조금불안", "불안정"], question: "정서 상태는?" },

  { key: "main_hospital", label: "주 의료기관", group: "병력", type: "text", question: "주로 다니시는 병원은?" },
  { key: "disease_history", label: "발병시기/병력", group: "병력", type: "textarea", question: "언제 어떤 병을 진단받으셨나요?" },
  { key: "medications", label: "복용약", group: "병력", type: "text", question: "현재 복용 중인 약은?" },

  { key: "individual_needs", label: "개별욕구", group: "종합", type: "textarea", question: "어르신/보호자의 개별적 요청사항은?" },
  { key: "counselor_opinion", label: "상담자의견", group: "종합", type: "textarea", question: "상담자 의견 (필요한 도움 중심)?" },
];

function isMissing(v: any) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export async function POST(req: Request) {
  const body = await req.json();
  const extracted = body?.extracted ?? {};
  const fields = FIELDS.map((f) => {
    const current = (extracted as any)[f.key];
    return { ...f, current, missing: isMissing(current) };
  });
  return NextResponse.json({ fields });
}
