import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Field = {
  key: string;
  label: string;
  group: string;
  type: "text" | "number" | "textarea" | "select" | "boolean";
  options?: string[];
  placeholder?: string;
  current?: any;
};

const FIELDS: Field[] = [
  // 기본/건강
  { key: "long_term_care_id", label: "장기요양인정번호", group: "기본사항", type: "text", placeholder: "예: L0000000000" },
  { key: "recent_hospitalization", label: "최근 3개월 입원 여부/기간", group: "건강상태", type: "text", placeholder: "예: 2025.07 담석 수술 5일 입원" },
  { key: "falls_3mo", label: "최근 3개월 낙상 횟수", group: "건강상태", type: "number", placeholder: "예: 0, 2" },
  { key: "oral_status", label: "구강 상태", group: "건강상태", type: "text", placeholder: "예: 의치 사용, 본인치아 다수, 임플란트 4개" },
  { key: "oral_health", label: "구강 위생", group: "건강상태", type: "select", options: ["양호", "보통", "불량"] },
  { key: "meal_intake", label: "식사 섭취량/종류", group: "건강상태", type: "text", placeholder: "예: 일반식 정량, 다짐찬 위주" },
  { key: "sleep_status", label: "수면 상태", group: "건강상태", type: "text", placeholder: "예: 양호, 자주 깸, 불면" },

  // 통증
  { key: "pain_site", label: "통증 부위", group: "통증", type: "text", placeholder: "예: 허리, 무릎" },
  { key: "pain_score", label: "통증 점수 (0~10)", group: "통증", type: "number", placeholder: "0~10" },
  { key: "pain_freq", label: "통증 빈도", group: "통증", type: "text", placeholder: "예: 주 2~3회, 일 1회 이상" },
  { key: "pain_manage", label: "통증 관리 방법", group: "통증", type: "text", placeholder: "예: 일반진통제, 물리치료" },

  // 인지·행동
  { key: "cognitive_status", label: "인지 상태", group: "인지·행동", type: "select", options: ["정상", "경도 저하", "중등도 저하", "중증", "모름"] },
  { key: "memory_short", label: "단기기억장애 유무", group: "인지·행동", type: "boolean" },
  { key: "disorientation_place", label: "장소 혼돈 유무", group: "인지·행동", type: "boolean" },
  { key: "wandering", label: "배회/길 잃음", group: "인지·행동", type: "boolean" },
  { key: "aggression", label: "공격성/과민 반응", group: "인지·행동", type: "boolean" },
  { key: "hallucination", label: "환각/망상", group: "인지·행동", type: "boolean" },
  { key: "depression", label: "우울감", group: "인지·행동", type: "boolean" },

  // 감각·의사소통
  { key: "vision_status", label: "시력 상태", group: "감각·의사소통", type: "text", placeholder: "예: 양호, 노안, 안경 사용" },
  { key: "hearing_status", label: "청력 상태", group: "감각·의사소통", type: "text", placeholder: "예: 양호, 이명, 보청기 착용" },
  { key: "communication_level", label: "의사소통 수준", group: "감각·의사소통", type: "select", options: ["원활", "단순 대화 가능", "대답만 가능", "곤란"] },

  // ADL
  { key: "adl_dressing", label: "옷 갈아입기", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },
  { key: "adl_washing", label: "세수·양치", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },
  { key: "adl_bathing", label: "목욕", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },
  { key: "adl_mobility", label: "체위 변경·이동", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },
  { key: "adl_cooking", label: "식사 준비", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },
  { key: "adl_housework", label: "청소·세탁", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },
  { key: "adl_shopping", label: "외출·장보기", group: "일상생활(ADL)", type: "select", options: ["자립", "부분도움", "완전도움"] },

  // 간호처치
  { key: "nurse_tube", label: "경관 영양", group: "간호처치", type: "boolean" },
  { key: "nurse_tracheostomy", label: "기관지 절개관", group: "간호처치", type: "boolean" },
  { key: "nurse_oxygen", label: "산소요법", group: "간호처치", type: "boolean" },
  { key: "nurse_suction", label: "흡인", group: "간호처치", type: "boolean" },
  { key: "nurse_pressure_sore", label: "욕창 관리", group: "간호처치", type: "boolean" },
  { key: "nurse_catheter", label: "도뇨관 관리", group: "간호처치", type: "boolean" },
  { key: "nurse_stoma", label: "장루 관리", group: "간호처치", type: "boolean" },
  { key: "nurse_dialysis", label: "투석", group: "간호처치", type: "boolean" },

  // 재활
  { key: "rehab_rom", label: "관절 운동(ROM) 필요", group: "재활", type: "boolean" },
  { key: "rehab_device", label: "보조기구 사용", group: "재활", type: "text", placeholder: "예: 지팡이, 보행기, 휠체어" },

  // 사회·가족
  { key: "social_family", label: "가족 교류 빈도", group: "사회·가족", type: "select", options: ["주 1회 이상", "월 1~2회", "분기 1~2회", "연 1회 이하", "없음"] },
  { key: "social_friends", label: "친구·이웃 교류 빈도", group: "사회·가족", type: "select", options: ["주 1회 이상", "월 1~2회", "분기 1~2회", "연 1회 이하", "없음"] },
  { key: "primary_caregiver", label: "주 수발자", group: "사회·가족", type: "text", placeholder: "예: 큰아들 이현수" },
  { key: "secondary_caregiver", label: "부 수발자/보조 수발", group: "사회·가족", type: "text", placeholder: "예: 며느리 주 1회" },
  { key: "primary_caregiver_burden", label: "주돌봄자 부담 정도", group: "사회·가족", type: "select", options: ["부담 없음", "가끔 부담됨", "자주 부담됨", "매우 부담됨"] },

  // 주거환경
  { key: "floor", label: "거주층", group: "주거환경", type: "text", placeholder: "예: 1층, 3층" },
  { key: "stairs", label: "계단 유무", group: "주거환경", type: "boolean" },
  { key: "elevator", label: "엘리베이터 유무", group: "주거환경", type: "boolean" },
  { key: "thresholds", label: "문턱 유무", group: "주거환경", type: "boolean" },
  { key: "toilet_location", label: "화장실 위치", group: "주거환경", type: "select", options: ["실내", "실외"] },
  { key: "hot_water", label: "온수 사용 가능", group: "주거환경", type: "boolean" },
  { key: "shower", label: "샤워시설 유무", group: "주거환경", type: "boolean" },
  { key: "handrail", label: "안전 손잡이 설치", group: "주거환경", type: "boolean" },
  { key: "heating", label: "난방 방식", group: "주거환경", type: "text", placeholder: "예: 보일러, 전기장판" },

  // 서비스 욕구
  { key: "service_wish", label: "어르신 개별 요청사항", group: "서비스 욕구", type: "textarea", placeholder: "예: 산책 도움, 병원 동행" },
  { key: "family_wish", label: "보호자 요청사항", group: "서비스 욕구", type: "textarea", placeholder: "예: 식사 챙기기, 복약 관리" },
];

function getExisting(senior: any, key: string): any {
  const f = senior?.needs_assessment_full ?? {};
  const maps: Record<string, any[]> = {
    long_term_care_id: [senior?.long_term_care_id, f.section1_general?.long_term_care_id],
    recent_hospitalization: [f.section2_health?.recent_hospitalization],
    falls_3mo: [senior?.falls_3mo, f.section4_physical?.falls_3mo],
    oral_status: [f.section2_health?.oral_status],
    oral_health: [f.section2_health?.oral_health],
    meal_intake: [f.section2_health?.meal_intake],
    sleep_status: [f.section2_health?.sleep_status],

    pain_site: [senior?.nursing_needs?.pain, f.section5_nursing?.pain_site],
    pain_score: [f.section5_nursing?.pain_score],
    pain_freq: [f.section5_nursing?.pain_freq],
    pain_manage: [f.section5_nursing?.pain_manage],

    cognitive_status: [f.section3_cognition?.cognitive_status],
    memory_short: [f.section3_cognition?.memory_short],
    disorientation_place: [f.section3_cognition?.disorientation_place],
    wandering: [f.section3_cognition?.wandering],
    aggression: [f.section3_cognition?.aggression],
    hallucination: [f.section3_cognition?.hallucination],
    depression: [f.section3_cognition?.depression],

    vision_status: [f.section2_health?.vision_status],
    hearing_status: [f.section2_health?.hearing_status],
    communication_level: [f.section3_cognition?.communication_level],

    adl_dressing: [f.section4_physical?.adl_dressing],
    adl_washing: [f.section4_physical?.adl_washing],
    adl_bathing: [f.section4_physical?.adl_bathing],
    adl_mobility: [f.section4_physical?.adl_mobility],
    adl_cooking: [f.section4_physical?.adl_cooking],
    adl_housework: [f.section4_physical?.adl_housework],
    adl_shopping: [f.section4_physical?.adl_shopping],

    nurse_tube: [f.section5_nursing?.nurse_tube],
    nurse_tracheostomy: [f.section5_nursing?.nurse_tracheostomy],
    nurse_oxygen: [f.section5_nursing?.nurse_oxygen],
    nurse_suction: [f.section5_nursing?.nurse_suction],
    nurse_pressure_sore: [f.section5_nursing?.nurse_pressure_sore],
    nurse_catheter: [f.section5_nursing?.nurse_catheter],
    nurse_stoma: [f.section5_nursing?.nurse_stoma],
    nurse_dialysis: [f.section5_nursing?.nurse_dialysis],

    rehab_rom: [f.section6_rehab?.rehab_rom],
    rehab_device: [f.section6_rehab?.rehab_device],

    social_family: [f.section7_support?.social_family],
    social_friends: [f.section7_support?.social_friends],
    primary_caregiver: [senior?.primary_caregiver, f.section7_support?.primary_caregiver],
    secondary_caregiver: [f.section7_support?.secondary_caregiver],
    primary_caregiver_burden: [senior?.caregiver_burden, f.section7_support?.primary_caregiver_burden],

    floor: [senior?.environment?.floor, f.section8_environment?.floor],
    stairs: [senior?.environment?.has_stairs, f.section8_environment?.stairs],
    elevator: [senior?.environment?.has_elevator, f.section8_environment?.elevator],
    thresholds: [senior?.environment?.has_thresholds, f.section8_environment?.thresholds],
    toilet_location: [f.section8_environment?.toilet_location],
    hot_water: [senior?.environment?.has_hot_water, f.section8_environment?.hot_water],
    shower: [senior?.environment?.has_shower, f.section8_environment?.shower],
    handrail: [f.section8_environment?.handrail],
    heating: [f.section8_environment?.heating],

    service_wish: [f.section9_needs?.service_wish, senior?.service_wish],
    family_wish: [f.section9_needs?.family_wish],
  };
  for (const v of maps[key] ?? []) {
    if (v !== undefined && v !== null && v !== "" && !(typeof v === "string" && v === "정보 없음")) return v;
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: senior, error } = await supabase.from("seniors").select("*").eq("id", id).maybeSingle();
  if (error || !senior) return NextResponse.json({ error: "대상자 없음" }, { status: 404 });

  const fields = FIELDS.map((f) => {
    const current = getExisting(senior, f.key);
    return { ...f, current, missing: current === null || current === undefined || current === "" };
  });
  return NextResponse.json({ fields });
}
