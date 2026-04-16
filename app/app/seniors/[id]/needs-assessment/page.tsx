"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, RefreshCw, Loader2 } from "lucide-react";

const C = (on: boolean) => (on ? "[✓]" : "[ ]");

export default function NeedsAssessmentFullPage() {
  const { id } = useParams() as { id: string };
  const { data: seniorRes } = useSWR<any>(`/api/seniors/${id}`);
  const [generating, setGenerating] = useState(false);

  if (!seniorRes) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  const senior = seniorRes.senior;
  const full = senior?.needs_assessment_full as any;

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/seniors/${id}/needs-assessment/generate`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      mutate(`/api/seniors/${id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="no-print px-4 py-3 max-w-4xl mx-auto flex items-center justify-between gap-2">
        <Link href={`/seniors/${id}`} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 대상자로
        </Link>
        <div className="flex gap-2">
          <button onClick={generate} disabled={generating} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} /> {full ? "갱신" : "생성"}
          </button>
          {full && (
            <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
              <Printer className="w-4 h-4" /> 인쇄
            </button>
          )}
        </div>
      </div>

      {!full ? (
        <div className="no-print max-w-4xl mx-auto px-4 py-10 text-center">
          <p className="text-gray-500 mb-4">아직 생성되지 않았습니다.</p>
          <button onClick={generate} disabled={generating} className="min-h-[44px] px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 작성 중 (1~3분)...</> : "AI로 욕구사정지 생성"}
          </button>
        </div>
      ) : (
        <article className="print-sheet max-w-4xl mx-auto bg-white border p-6 sm:p-10 mb-4 text-xs space-y-4">
          <HeaderBlock d={full.header} />
          <Section1 d={full.section1_general} />
          <h2 className="text-base font-bold pt-2">욕구조사기록지</h2>
          <Section2 d={full.section2_health} />
          <div className="page-break" />
          <Section3 d={full.section3_adl} />
          <Section4 d={full.section4_physical} />
          <div className="page-break" />
          <Section5 d={full.section5_nursing} />
          <Section6 d={full.section6_cognition} />
          <div className="page-break" />
          <Section7 d={full.section7_support} />
          <Section8 d={full.section8_environment} />
          <div className="page-break" />
          <Section9 d={full.section9_desired} />
          <Section10 d={full.section10_summary} />
        </article>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th className="border border-black bg-gray-50 text-left px-2 py-1 w-28 font-medium">{label}</th>
      <td className="border border-black px-2 py-1">{value}</td>
    </tr>
  );
}

function HeaderBlock({ d }: { d: any }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        <tr>
          <th className="border border-black bg-gray-50 px-2 py-1 w-20">기관명</th>
          <td className="border border-black px-2 py-1">{d?.center_name}</td>
          <th className="border border-black bg-gray-50 px-2 py-1 w-20">기관기호</th>
          <td className="border border-black px-2 py-1">{d?.center_code}</td>
          <th className="border border-black bg-gray-50 px-2 py-1 w-16">작성일</th>
          <td className="border border-black px-2 py-1">{d?.written_at}</td>
        </tr>
        <tr>
          <th className="border border-black bg-gray-50 px-2 py-1">작성자 성명</th>
          <td className="border border-black px-2 py-1">{d?.writer_name}</td>
          <th className="border border-black bg-gray-50 px-2 py-1">직종</th>
          <td className="border border-black px-2 py-1" colSpan={3}>{d?.writer_role}</td>
        </tr>
        <tr>
          <th className="border border-black bg-gray-50 px-2 py-1">욕구조사 유형</th>
          <td className="border border-black px-2 py-1" colSpan={5}>
            {["최초", "정기", "상태변화", "기타"].map((t) => (
              <span key={t} className="mr-4">{C(d?.survey_type === t)} {t}</span>
            ))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Section1({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">1. 일반사항</h3>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <th rowSpan={2} className="border border-black bg-gray-50 px-2 py-1 w-20">수급자</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-16">성명</th>
            <td className="border border-black px-2 py-1">{d?.name}</td>
            <th className="border border-black bg-gray-50 px-2 py-1 w-16">성별</th>
            <td className="border border-black px-2 py-1">{C(d?.gender === "M")} 남 &nbsp; {C(d?.gender === "F")} 여</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1">장기요양인정번호</th>
            <td className="border border-black px-2 py-1">{d?.long_term_care_id}</td>
            <th className="border border-black bg-gray-50 px-2 py-1">등급</th>
            <td className="border border-black px-2 py-1">{d?.grade}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1">생년월일</th>
            <td className="border border-black px-2 py-1" colSpan={4}>{d?.birth_date} ({d?.age}세)</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1">면담자</th>
            <td className="border border-black px-2 py-1" colSpan={4}>
              {C(d?.interviewer_type === "수급자")} 수급자 &nbsp;&nbsp;
              {C(d?.interviewer_type === "보호자")} 보호자 (성명 {d?.interviewer_name}, 주수발자 {C(d?.is_primary_caregiver)} Y {C(!d?.is_primary_caregiver)} N)
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Section2({ d }: { d: any }) {
  const dis = d?.diseases ?? {};
  return (
    <div>
      <h3 className="font-bold mb-1">2. 일반적 건강상태</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="키 / 체중 / BMI" value={`${d?.height_cm ?? "-"}cm / ${d?.weight_kg ?? "-"}kg / BMI ${d?.bmi ?? "-"}`} />
          <Row label="뇌신경계" value={(dis.neuro ?? []).join(", ") || "없음"} />
          <Row label="호흡·순환기계" value={(dis.cardio ?? []).join(", ") || "없음"} />
          <Row label="내분비·대사" value={(dis.endocrine ?? []).join(", ") || "없음"} />
          <Row label="근골격계" value={(dis.musculo ?? []).join(", ") || "없음"} />
          <Row label="비뇨생식기계" value={(dis.uro ?? []).join(", ") || "없음"} />
          <Row label="감각계" value={(dis.sensory ?? []).join(", ") || "없음"} />
          <Row label="감염" value={(dis.infection ?? []).join(", ") || "없음"} />
          <Row label="기타 질환" value={`${dis.other_cancer ? "암: " + dis.other_cancer : ""} ${dis.other_allergy ? "알레르기: " + dis.other_allergy : ""} ${dis.other_other ?? ""}`.trim() || "없음"} />
          <Row label="복약 및 의료이용" value={
            d?.medication_none ? "복용 약 없음" :
            `${d?.medication_regular?.reason ? "정기: " + d.medication_regular.reason + " / " + (d.medication_regular.hospital ?? "") + " / " + (d.medication_regular.interval ?? "") : ""}${d?.medication_sleep ? " / 수면장애 복약" : ""}`
          } />
          <Row label="구강상태" value={d?.oral_status} />
          <Row label="구강건강" value={d?.oral_health} />
          <Row label="식사형태" value={`${d?.diet_form} / 치료식: ${d?.therapeutic_diet}`} />
          <Row label="식사 유의사항" value={d?.meal_notes} />
          <Row label="영양상태" value={d?.nutrition} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="border border-black px-2 py-1">{label}</td>
      {[0, 1, 2, 3].map((n) => (
        <td key={n} className="border border-black px-2 py-1 text-center">{value === n ? "✓" : ""}</td>
      ))}
    </tr>
  );
}

function Section3({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">3. 일상생활기능</h3>
      <p className="text-[10px] mb-1">※ (0)혼자 할 수 있음, (1) 지시(준비)도움, (2) 직접(부축)도움, (3) 전혀 수행할 수 없음</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1">구분</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">0</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">1</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">2</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">3</th>
          </tr>
        </thead>
        <tbody>
          <ScoreRow label="세수하기" value={d?.wash ?? 0} />
          <ScoreRow label="양치질하기(틀니관리)" value={d?.brush ?? 0} />
          <ScoreRow label="화장실(이동변기) 사용하기" value={d?.toilet ?? 0} />
          <ScoreRow label="몸 씻기" value={d?.bath ?? 0} />
          <ScoreRow label="옷 벗고 입기" value={d?.dress ?? 0} />
          <ScoreRow label="식사하기" value={d?.eat ?? 0} />
          <ScoreRow label="음식 삼키기" value={d?.swallow ?? 0} />
          <ScoreRow label="청소 및 정리정돈" value={d?.clean ?? 0} />
          <ScoreRow label="식사 준비하기" value={d?.cook ?? 0} />
          <ScoreRow label="빨래하기" value={d?.laundry ?? 0} />
          <ScoreRow label="교통수단 이용하기" value={d?.transport ?? 0} />
          <ScoreRow label="약 챙겨먹기" value={d?.medication ?? 0} />
          <ScoreRow label="물건사기" value={d?.shopping ?? 0} />
        </tbody>
      </table>
      <table className="w-full border-collapse mt-2">
        <tbody>
          <Row label="배뇨기능" value={d?.urination_function} />
          <Row label="배뇨방법" value={d?.urination_method} />
          <Row label="배변기능" value={d?.defecation_function} />
          <Row label="배변방법" value={d?.defecation_method} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section4({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">4. 재활 및 신체기능</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="관절구축" value={d?.joint_contracture} />
          <Row label="운동장애" value={d?.motor_disorder} />
          <Row label="마비" value={d?.paralysis} />
          <Row label="절단" value={d?.amputation} />
          <Row label="보행상태" value={d?.gait} />
          <Row label="보장구" value={(d?.aids ?? []).join(", ") || "없음"} />
          <Row label="지난 3개월 낙상" value={d?.falls_3mo > 0 ? `있음 (${d.falls_3mo}회)` : "없음"} />
        </tbody>
      </table>
      <table className="w-full border-collapse mt-2">
        <thead>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1">신체기능</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">0</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">1</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">2</th>
            <th className="border border-black bg-gray-50 px-2 py-1 w-10">3</th>
          </tr>
        </thead>
        <tbody>
          <ScoreRow label="옆으로 돌아눕기" value={d?.turn ?? 0} />
          <ScoreRow label="몸 일으켜 앉기" value={d?.sit_up ?? 0} />
          <ScoreRow label="바닥에서 일어서기" value={d?.stand ?? 0} />
          <ScoreRow label="실내 보행하기" value={d?.walk ?? 0} />
        </tbody>
      </table>
      <table className="w-full border-collapse mt-2">
        <tbody>
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section5({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">5. 간호관리</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="호흡기간호" value={d?.respiratory} />
          <Row label="피부간호" value={d?.skin} />
          <Row label="소화기간호" value={d?.digestive} />
          <Row label="통증간호" value={`${d?.pain_type ?? "없음"}${d?.pain_site ? " / " + d.pain_site : ""}${d?.pain_score ? " / " + d.pain_score + "점" : ""}${d?.pain_freq ? " / " + d.pain_freq : ""}${d?.pain_manage ? " / " + d.pain_manage : ""}`} />
          <Row label="배뇨간호" value={d?.urination_care} />
          <Row label="배변간호" value={d?.defecation_care} />
          <Row label="내분비간호" value={d?.endocrine} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section6({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">6. 인지 및 의사소통</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="인지기능" value={(d?.cognitive ?? []).join(", ") || "양호"} />
          <Row label="행동증상" value={(d?.behavior ?? []).join(", ") || "없음"} />
          <Row label="심리증상" value={(d?.psychological ?? []).join(", ") || "없음"} />
          <Row label="이해능력" value={d?.comm_understand} />
          <Row label="표현능력" value={d?.comm_express} />
          <Row label="시력상태" value={d?.comm_vision} />
          <Row label="청력상태" value={d?.comm_hearing} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section7({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">7. 수급자의 가족 및 지지체계</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="주거형태" value={d?.residence} />
          <Row label="동거인" value={(d?.cohabitant ?? []).join(", ") || "독거"} />
          <Row label="자녀" value={`아들 ${d?.children_son ?? 0}명, 딸 ${d?.children_daughter ?? 0}명`} />
          <Row label="주 수발자" value={d?.primary_caregiver_present ? `${d?.primary_caregiver_relation ?? "-"} / 부양부담: ${d?.primary_caregiver_burden ?? "-"}` : "없음"} />
          <Row label="가족 교류" value={d?.social_family} />
          <Row label="친구·이웃 교류" value={d?.social_friends} />
          <Row label="지역사회 자원" value={(d?.community ?? []).join(", ") || "없음"} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section8({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">8. 수급자가 거주하는 곳의 환경</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="거주 층수" value={d?.floor} />
          <Row label="엘리베이터" value={C(d?.elevator)} />
          <Row label="실내·외 계단" value={C(d?.stairs)} />
          <Row label="실내 장애물(문턱)" value={C(d?.thresholds)} />
          <Row label="바닥·벽지" value={d?.floor_wall} />
          <Row label="냉·난방 및 환기" value={d?.hvac} />
          <Row label="조명" value={d?.lighting} />
          <Row label="주방 상태" value={d?.kitchen} />
          <Row label="화장실 위치" value={d?.toilet_location} />
          <Row label="좌변기 / 온수 / 샤워기 / 세면대" value={`${C(d?.toilet_seat)}좌변기 ${C(d?.hot_water)}온수 ${C(d?.shower)}샤워기 ${C(d?.sink)}세면대`} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section9({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">9. 수급자 및 보호자가 희망하는 서비스</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="신체활동지원" value={(d?.physical ?? []).join(", ") || "-"} />
          <Row label="일상생활 지원" value={(d?.daily ?? []).join(", ") || "-"} />
          <Row label="기능회복훈련" value={(d?.rehab ?? []).join(", ") || "-"} />
          <Row label="인지관리 및 정서지원" value={(d?.cognition ?? []).join(", ") || "-"} />
          <Row label="건강 및 간호관리" value={(d?.health ?? []).join(", ") || "-"} />
          <Row label="방문목욕" value={(d?.bath ?? []).join(", ") || "-"} />
          <Row label="복지용구 희망품목" value={(d?.aids ?? []).join(", ") || "-"} />
          <Row label="지역사회 자원" value={(d?.community ?? []).join(", ") || "-"} />
          <Row label="의견 및 판단근거" value={<span className="whitespace-pre-wrap">{d?.opinion}</span>} />
        </tbody>
      </table>
    </div>
  );
}

function Section10({ d }: { d: any }) {
  return (
    <div>
      <h3 className="font-bold mb-1">10. 종합의견</h3>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="1. 건강상태" value={<span className="whitespace-pre-wrap">{d?.health}</span>} />
          <Row label="2. 생활기능 및 신체기능" value={<span className="whitespace-pre-wrap">{d?.function}</span>} />
          <Row label="3. 인지 및 의사소통" value={<span className="whitespace-pre-wrap">{d?.cognition}</span>} />
          <Row label="4. 장기요양급여 제공계획서방향" value={<span className="whitespace-pre-wrap">{d?.care_plan_direction}</span>} />
        </tbody>
      </table>
    </div>
  );
}
