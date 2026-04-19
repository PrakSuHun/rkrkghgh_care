// 업무 인계·인수 확인서 자동 채움 헬퍼
// — handover_data 가 비었을 때만 사용. 이미 저장된 값은 절대 덮어쓰지 않음.

export type HandoverData = {
  // 수급자 정보
  recipient_name: string;
  birth_date: string;
  phone: string;
  guardian_name: string;
  address: string;
  // 급여제공내용
  service_body: string[];
  service_housework: string[];
  service_emotion: string[];
  service_note: string;
  // 건강상태
  disease_note: string;
  dementia_yes: boolean | null;
  dementia_level: string; // 상/중/하
  dementia_symptom: string;
  medication_yes: boolean | null;
  medication_count: string;
  medication_list: string;
  // 생활환경
  life_environment_note: string;
  // 인계인수 메타
  handover_date: string;
  handover_reason: string;
  from_worker: string;
  to_worker: string;
  from_worker_id: number | null;
  to_worker_id: number | null;
};

const norm = (v: any): string => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return String(v).trim();
};

const includesAny = (hay: string, needles: string[]): boolean => {
  const h = (hay ?? "").toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
};

const todayKST = (): string => {
  const d = new Date();
  // KST = UTC+9 — 단순히 로컬 날짜 사용 (브라우저/서버 모두 KST 가정)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ADL/욕구 텍스트에서 신체활동 지원 항목을 추론
function inferServiceBody(intake: any, full: any): string[] {
  const result = new Set<string>();
  const buckets: string[] = [];
  if (intake) {
    buckets.push(norm(intake.individual_needs));
    buckets.push(norm(intake.counselor_opinion));
    buckets.push(norm(intake.service_use));
    buckets.push(norm(intake.eating));
    buckets.push(norm(intake.toilet));
    buckets.push(norm(intake.walking));
    buckets.push(norm(intake.bowel));
  }
  if (full?.section9_desired) {
    buckets.push(norm(full.section9_desired.physical));
    buckets.push(norm(full.section9_desired.daily));
    buckets.push(norm(full.section9_desired.bath));
  }
  if (full?.section3_adl) {
    const a = full.section3_adl;
    // 점수 1 이상이면 도움 필요로 간주 (0=자립, 1=감독, 2=부분도움, 3=완전도움)
    if (typeof a.wash === "number" && a.wash >= 1) result.add("세면도움");
    if (typeof a.brush === "number" && a.brush >= 1) result.add("구강관리");
    if (typeof a.bath === "number" && a.bath >= 1) result.add("목욕도움");
    if (typeof a.dress === "number" && a.dress >= 1) result.add("옷갈아입기");
    if (typeof a.eat === "number" && a.eat >= 1) result.add("식사도움");
    if (typeof a.toilet === "number" && a.toilet >= 1) result.add("화장실이용하기");
  }
  const text = buckets.filter(Boolean).join(" / ");

  if (includesAny(text, ["세면", "씻", "얼굴"])) result.add("세면도움");
  if (includesAny(text, ["몸단장", "단장", "옷매무"])) result.add("몸단장");
  if (includesAny(text, ["목욕", "샤워"])) result.add("목욕도움");
  if (includesAny(text, ["체위", "돌려눕", "자세 변경"])) result.add("체위변경");
  if (includesAny(text, ["구강", "양치", "치아 관리", "이 닦"])) result.add("구강관리");
  if (includesAny(text, ["옷", "갈아입", "탈의", "착의"])) result.add("옷갈아입기");
  if (includesAny(text, ["화장실", "변기", "용변"])) result.add("화장실이용하기");
  if (includesAny(text, ["기능 유지", "재활", "운동", "신체기능"])) result.add("신체기능의 유지·증진");
  if (includesAny(text, ["식사", "끼니", "밥"])) result.add("식사도움");
  if (includesAny(text, ["머리감", "세발"])) result.add("머리감기기");
  if (includesAny(text, ["배설", "기저귀", "대변", "소변"])) result.add("배설도움");
  if (includesAny(text, ["이동", "보행", "휠체어", "거동"])) result.add("이동도움");

  // walking="도움"|"완전도움" → 이동도움
  if (intake && (intake.walking === "도움" || intake.walking === "완전도움")) result.add("이동도움");
  if (intake && (intake.eating === "도움" || intake.eating === "완전도움")) result.add("식사도움");
  if (intake && (intake.toilet === "도움" || intake.toilet === "완전도움")) result.add("화장실이용하기");

  return Array.from(result);
}

function inferServiceHousework(intake: any, full: any): string[] {
  const result = new Set<string>();
  const buckets: string[] = [];
  if (intake) {
    buckets.push(norm(intake.individual_needs));
    buckets.push(norm(intake.counselor_opinion));
  }
  if (full?.section9_desired) {
    buckets.push(norm(full.section9_desired.daily));
  }
  if (full?.section3_adl) {
    const a = full.section3_adl;
    if (typeof a.cook === "number" && a.cook >= 1) result.add("취사");
    if (typeof a.clean === "number" && a.clean >= 1) result.add("청소 및 주변정돈");
    if (typeof a.laundry === "number" && a.laundry >= 1) result.add("세탁");
    if (typeof a.shopping === "number" && a.shopping >= 1) result.add("시장보기");
    if (typeof a.transport === "number" && a.transport >= 1) result.add("외출 시 동행");
  }
  const text = buckets.filter(Boolean).join(" / ");

  if (includesAny(text, ["외출", "동행", "병원 동", "병원동"])) result.add("외출 시 동행");
  if (includesAny(text, ["취사", "조리", "요리", "식사 준비"])) result.add("취사");
  if (includesAny(text, ["일상 업무", "업무 대행", "대행"])) result.add("일상 업무 대행");
  if (includesAny(text, ["청소", "정돈", "정리"])) result.add("청소 및 주변정돈");
  if (includesAny(text, ["시장", "장보기", "쇼핑", "마트"])) result.add("시장보기");
  if (includesAny(text, ["세탁", "빨래"])) result.add("세탁");

  return Array.from(result);
}

function inferServiceEmotion(intake: any, full: any): string[] {
  const result = new Set<string>();
  const buckets: string[] = [];
  if (intake) {
    buckets.push(norm(intake.individual_needs));
    buckets.push(norm(intake.counselor_opinion));
    buckets.push(norm(intake.emotion));
    buckets.push(norm(intake.personality));
  }
  if (full?.section6_cognition) {
    buckets.push(norm(full.section6_cognition.opinion));
  }
  if (full?.section7_support) {
    buckets.push(norm(full.section7_support.opinion));
  }
  const text = buckets.filter(Boolean).join(" / ");

  if (
    includesAny(text, ["말벗", "정서", "외로", "우울", "격려", "대화", "고립", "혼자"])
    || (intake && (intake.emotion === "조금불안" || intake.emotion === "불안정"))
  ) {
    result.add("말벗 격려");
  }
  return Array.from(result);
}

function buildDiseaseNote(senior: any, intake: any, full: any): string {
  const lines: string[] = [];
  // 1) intake.disease_history 우선
  if (intake?.disease_history) lines.push(norm(intake.disease_history));
  // 2) intake.diseases — 치매 제외
  if (Array.isArray(intake?.diseases)) {
    const ds = intake.diseases.filter((d: any) => d && !String(d).includes("치매"));
    if (ds.length) lines.push(`기저질환: ${ds.join(", ")}`);
  }
  // 3) seniors.major_diseases (compat: senior.diseases)
  const sDiseases = senior?.diseases ?? senior?.major_diseases;
  if (Array.isArray(sDiseases) && sDiseases.length) {
    const ds = sDiseases.filter((d: any) => d && !String(d).includes("치매"));
    if (ds.length && !lines.some((l) => ds.every((d: string) => l.includes(d)))) {
      lines.push(`등록 질환: ${ds.join(", ")}`);
    }
  }
  // 4) 욕구사정 질환 분류 (있으면 보충)
  if (full?.section2_health?.diseases) {
    const d = full.section2_health.diseases;
    const all: string[] = [];
    for (const k of ["neuro", "cardio", "endocrine", "musculo", "uro", "sensory", "infection"]) {
      if (Array.isArray(d[k])) all.push(...d[k].filter(Boolean));
    }
    const filtered = all.filter((x) => !String(x).includes("치매"));
    if (filtered.length) {
      const joined = filtered.join(", ");
      if (!lines.some((l) => l.includes(joined))) {
        lines.push(`공단 욕구사정 등록 질환: ${joined}`);
      }
    }
  }
  return lines.filter(Boolean).join("\n");
}

function detectDementia(senior: any, intake: any, full: any): boolean | null {
  // intake.diseases 에 치매
  if (Array.isArray(intake?.diseases) && intake.diseases.some((d: any) => String(d ?? "").includes("치매"))) return true;
  // 욕구사정 신경계 질환
  const neuro = full?.section2_health?.diseases?.neuro;
  if (Array.isArray(neuro) && neuro.some((d: any) => String(d ?? "").includes("치매"))) return true;
  // seniors.major_diseases
  const sDiseases = senior?.diseases ?? senior?.major_diseases;
  if (Array.isArray(sDiseases) && sDiseases.some((d: any) => String(d ?? "").includes("치매"))) return true;
  // 인지 영역 텍스트에 치매 명시
  const cogText = norm(full?.section6_cognition?.opinion);
  if (cogText.includes("치매")) return true;
  return null;
}

function detectDementiaLevel(full: any, intake: any): string {
  const cog = full?.section6_cognition?.cognitive;
  const cogText = `${norm(cog)} ${norm(full?.section6_cognition?.opinion)} ${norm(intake?.counselor_opinion)}`;
  if (includesAny(cogText, ["중증", "심각", "고도"])) return "하";
  if (includesAny(cogText, ["중등도", "중간"])) return "중";
  if (includesAny(cogText, ["경도", "초기", "경미"])) return "상";
  return "";
}

function detectDementiaSymptom(full: any, intake: any): string {
  const buckets = [
    norm(full?.section6_cognition?.behavior),
    norm(full?.section6_cognition?.psychological),
    norm(full?.section6_cognition?.opinion),
    norm(intake?.counselor_opinion),
  ];
  const text = buckets.filter(Boolean).join(" / ");
  const symptoms: string[] = [];
  for (const k of ["배회", "공격", "망상", "환각", "수면장애", "의심", "초조", "불안", "거부", "반복질문", "야간"]) {
    if (text.includes(k)) symptoms.push(k);
  }
  // 행동/심리 배열은 그대로 노출
  const explicit: string[] = [];
  for (const arr of [full?.section6_cognition?.behavior, full?.section6_cognition?.psychological]) {
    if (Array.isArray(arr)) explicit.push(...arr.filter(Boolean).map(String));
  }
  const merged = Array.from(new Set([...explicit, ...symptoms]));
  return merged.join(", ");
}

function parseMedicationCount(medications: string): string {
  const s = norm(medications);
  if (!s) return "";
  // "당뇨, 고혈압, 퇴행성이명" 또는 "당뇨/고혈압" 형태
  const parts = s.split(/[,，、\/·•]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 1) return String(parts.length);
  return "";
}

function buildLifeEnvironment(senior: any, intake: any, full: any): string {
  const parts: string[] = [];
  if (intake?.cohabit_type || intake?.cohabit) {
    const t = norm(intake.cohabit_type);
    const c = norm(intake.cohabit);
    parts.push(`동거: ${[t, c].filter(Boolean).join(" / ")}`);
  }
  if (senior?.environment) {
    parts.push(`환경: ${norm(senior.environment)}`);
  }
  if (full?.section8_environment) {
    const e = full.section8_environment;
    const env: string[] = [];
    if (e.floor) env.push(String(e.floor));
    if (e.elevator) env.push("엘리베이터 있음");
    if (e.stairs) env.push("계단 있음");
    if (e.thresholds) env.push("문턱 있음");
    if (e.toilet_location) env.push(`화장실 ${e.toilet_location}`);
    if (e.opinion) env.push(norm(e.opinion));
    if (env.length) parts.push(`주거환경: ${env.join(", ")}`);
  }
  if (intake?.counselor_opinion) {
    parts.push(`상담자의견: ${norm(intake.counselor_opinion)}`);
  }
  if (senior?.nursing_needs && !parts.some((p) => p.includes(String(senior.nursing_needs)))) {
    parts.push(`요양 욕구: ${norm(senior.nursing_needs)}`);
  }
  return parts.filter(Boolean).join("\n");
}

function buildServiceNote(intake: any, senior: any): string {
  const lines: string[] = [];
  if (intake?.individual_needs) lines.push(`개별욕구: ${norm(intake.individual_needs)}`);
  if (intake?.counselor_opinion && intake?.counselor_opinion !== intake?.individual_needs) {
    lines.push(`상담자의견: ${norm(intake.counselor_opinion)}`);
  }
  if (!lines.length && senior?.nursing_needs) lines.push(norm(senior.nursing_needs));
  return lines.filter(Boolean).join("\n");
}

export function buildHandoverAutofill(args: {
  senior: any;
  intake?: any | null;
  full?: any | null;
}): HandoverData {
  const { senior } = args;
  const intake = args.intake?.extracted_data ?? args.intake ?? null;
  const full = args.full ?? senior?.needs_assessment_full ?? null;

  const dementia_yes = detectDementia(senior, intake, full);
  const dementia_level = dementia_yes === true ? detectDementiaLevel(full, intake) : "";
  const dementia_symptom = dementia_yes === true ? detectDementiaSymptom(full, intake) : "";

  const medications = norm(intake?.medications);
  const medication_yes = medications.length > 0 ? true : null;
  const medication_count = medication_yes ? parseMedicationCount(medications) : "";

  return {
    recipient_name: norm(senior?.name) || norm(intake?.name),
    birth_date: norm(senior?.birth_date) || norm(intake?.birth_date),
    phone: norm(senior?.phone) || norm(intake?.guardian_phone),
    guardian_name: norm(senior?.guardian_name) || norm(intake?.guardian_name),
    address: norm(senior?.address),

    service_body: inferServiceBody(intake, full),
    service_housework: inferServiceHousework(intake, full),
    service_emotion: inferServiceEmotion(intake, full),
    service_note: buildServiceNote(intake, senior),

    disease_note: buildDiseaseNote(senior, intake, full),
    dementia_yes,
    dementia_level,
    dementia_symptom,

    medication_yes,
    medication_count,
    medication_list: medications,

    life_environment_note: buildLifeEnvironment(senior, intake, full),

    handover_date: todayKST(),
    handover_reason: "",
    from_worker: "",
    to_worker: "",
    from_worker_id: null,
    to_worker_id: null,
  };
}

export function isHandoverEmpty(data: any): boolean {
  if (!data || typeof data !== "object") return true;
  // 핵심 필드 모두 비어 있으면 empty
  const keys = [
    "recipient_name", "service_note", "disease_note", "life_environment_note",
    "from_worker", "to_worker", "handover_date", "medication_list",
  ];
  const arrayKeys = ["service_body", "service_housework", "service_emotion"];
  const anyText = keys.some((k) => {
    const v = data[k];
    return typeof v === "string" && v.trim() !== "";
  });
  const anyArr = arrayKeys.some((k) => Array.isArray(data[k]) && data[k].length > 0);
  const anyBool = data.dementia_yes != null || data.medication_yes != null;
  return !(anyText || anyArr || anyBool);
}
