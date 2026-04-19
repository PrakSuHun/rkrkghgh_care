"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, Wand2, Pencil, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CENTER_INFO } from "@/lib/centerInfo";

type Dict = Record<string, any>;

function Cb({ on, label, onToggle, editing }: { on: boolean; label: string; onToggle: () => void; editing: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 mr-3 leading-6 ${editing ? "cursor-pointer select-none" : ""}`}
      onClick={() => editing && onToggle()}
    >
      <span className="text-base leading-none">{on ? "■" : "□"}</span>
      <span className="text-sm">{label}</span>
    </span>
  );
}

function Inline({ value, onChange, editing, width, placeholder }: { value: any; onChange: (v: string) => void; editing: boolean; width?: string; placeholder?: string }) {
  const text = value == null || value === false ? "" : String(value);
  if (editing) {
    return (
      <input
        type="text"
        className="border-b border-gray-400 px-1 text-sm bg-yellow-50 focus:outline-none focus:bg-yellow-100"
        style={{ width: width ?? "8rem" }}
        value={text}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <span className="text-sm">{text || "\u00a0"}</span>;
}

function Block({ value, onChange, editing, rows = 2 }: { value: any; onChange: (v: string) => void; editing: boolean; rows?: number }) {
  const text = value == null ? "" : String(value);
  const len = text.length;
  // 인쇄 시 긴 글은 폰트를 점진적으로 축소해 1페이지에 담기게
  const printSize = len > 300 ? 7 : len > 200 ? 8 : len > 120 ? 8.5 : 9.5;
  if (editing) {
    return (
      <textarea
        className="intake-block w-full border rounded px-1 py-1 text-sm bg-yellow-50 focus:outline-none focus:bg-yellow-100"
        rows={rows}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        data-print-size={printSize}
      />
    );
  }
  return <span className="intake-block text-sm whitespace-pre-wrap" data-print-size={printSize}>{text}</span>;
}

const DISEASE_CATEGORIES: Array<{ left: { name: string; items: string[] }; right: { name: string; items: string[] } }> = [
  { left: { name: "내분비대사", items: ["당뇨", "갑상선질환", "자가면역질환", "만성간염", "빈혈", "탈수", "양호"] }, right: { name: "정신행동장애", items: ["신경증", "우울증", "수면장애", "양호"] } },
  { left: { name: "소화기계", items: ["위염", "위궤양", "십이지궤양", "간경변증", "양호", "식도염"] }, right: { name: "호흡기계", items: ["폐결핵", "만성기관지염", "천식", "양호"] } },
  { left: { name: "순환기계", items: ["고혈압", "저혈압", "뇌혈관질환", "협심증", "심근경색증", "양호"] }, right: { name: "눈귀질환", items: ["시각장애", "난청", "양호", "이명", "황반변성"] } },
  { left: { name: "근골격계", items: ["관절염", "요통", "골다공증", "기타(고관절)", "양호"] }, right: { name: "비뇨생식기계", items: ["전립선비대", "요실금,변실금", "만성방광염", "신장투석", "양호"] } },
  { left: { name: "신경계", items: ["치매", "뇌경색", "파킨슨병", "두통", "두통 외 통증", "양호"] }, right: { name: "만성신장질환", items: ["만성신부전증", "신장기능저하", "양호"] } },
];

export default function IntakeFormPage() {
  const { id: seniorId } = useParams() as { id: string };
  const { data, mutate } = useSWR<any>(`/api/intake-forms?senior_id=${seniorId}`);
  const intake = data?.intakes?.[0];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Dict | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);

  if (!data) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!intake) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-3">
        <Link href={`/seniors/${seniorId}`} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 대상자로
        </Link>
        <div className="bg-white border rounded-xl p-6 text-center text-sm text-gray-500">
          등록된 초기상담기록지가 없습니다.
        </div>
      </div>
    );
  }

  const ed: Dict = editing && draft ? draft : (intake.extracted_data ?? {});
  const update = (key: string, val: any) =>
    setDraft((prev) => ({ ...((prev ?? intake.extracted_data) ?? {}), [key]: val }));

  const pick = (key: string, val: string) => update(key, ed[key] === val ? null : val);

  const diseases: string[] = Array.isArray(ed.diseases) ? ed.diseases : [];
  const hasDisease = (d: string) => diseases.includes(d);
  const toggleDisease = (d: string) => {
    const set = new Set(diseases);
    if (set.has(d)) set.delete(d); else set.add(d);
    update("diseases", Array.from(set));
  };

  const habits: string[] = ed.habit ? String(ed.habit).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) : [];
  const hasHabit = (h: string) => habits.includes(h);
  const toggleHabit = (h: string) => {
    const set = new Set(habits);
    if (set.has(h)) set.delete(h); else set.add(h);
    update("habit", Array.from(set).join(", "));
  };

  const startEdit = () => { setDraft({ ...(intake.extracted_data ?? {}) }); setEditing(true); };
  const cancel = () => { setDraft(null); setEditing(false); };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/intake-forms/${intake.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extracted_data: draft,
          counseling_date: draft.counseling_date ?? null,
          counselor_name: draft.counselor_name ?? null,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setDraft(null); setEditing(false);
      mutate();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const refine = async () => {
    if (!chatInput.trim()) return;
    setRefining(true);
    try {
      const res = await fetch(`/api/intake-forms/${intake.id}/refine`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: chatInput }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setChatInput("");
      mutate();
    } catch (e: any) { alert(e.message); } finally { setRefining(false); }
  };

  const thL = "border border-black bg-gray-50 text-center align-middle text-xs font-medium px-1 py-1";
  const td = "border border-black px-2 py-1.5 align-middle text-sm";

  const isEmpty = (v: any) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
  const ec = (v: any) => (isEmpty(v) ? " empty-mark" : "");
  const ecAny = (...vs: any[]) => (vs.every((v) => isEmpty(v)) ? " empty-mark" : "");

  const walk = ed.walking ?? "";
  const eat = ed.eating ?? "";
  const emo = ed.emotion ?? "";
  const toi = ed.toilet ?? "";
  const per = ed.personality ?? "";
  const bow = ed.bowel ?? "";
  const meal = ed.meal_form ?? "";
  const visionVal = ed.vision ?? "";
  const hearingVal = ed.hearing ?? "";
  const speechVal = ed.speech ?? "";
  const svc = ed.service_use ?? "";

  return (
    <>
      <div className="no-print px-4 py-3 max-w-5xl mx-auto flex items-center justify-between gap-2">
        <Link href={`/seniors/${seniorId}`} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 대상자로
        </Link>
        <div className="flex gap-2 flex-wrap justify-end">
          {editing ? (
            <>
              <button onClick={cancel} disabled={saving} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                <X className="w-4 h-4" /> 취소
              </button>
              <button onClick={save} disabled={saving} className="min-h-[40px] px-3 py-2 bg-green-600 active:bg-green-800 text-white rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1">
                <Pencil className="w-4 h-4" /> 편집
              </button>
              <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
                <Printer className="w-4 h-4" /> 인쇄
              </button>
            </>
          )}
        </div>
      </div>

      <article className="print-sheet intake-sheet max-w-5xl mx-auto bg-white border p-6 sm:p-10 mb-4">
        <h1 className="text-3xl font-bold text-center mb-5">초기상담기록지</h1>

        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <th className={`${thL} w-24`} colSpan={2}>상담일자</th>
              <td className={`${td} text-center${ec(ed.counseling_date)}`} colSpan={3}><Inline value={ed.counseling_date} onChange={(v) => update("counseling_date", v)} editing={editing} width="10rem" /></td>
              <th className={`${thL} w-20`} colSpan={2}>기록자</th>
              <td className={`${td}${ec(ed.counselor_name)}`} colSpan={3}>
                <span className="mr-3">직위:센터장</span>
                <span>이름: <Inline value={ed.counselor_name} onChange={(v) => update("counselor_name", v)} editing={editing} width="8rem" /> (서명)</span>
              </td>
            </tr>
            <tr>
              <th className={`${thL} w-12`} rowSpan={15}>대<br/>상<br/>자<br/>정<br/>보</th>
              <th className={`${thL} w-16`} rowSpan={3}>기본<br/>사항</th>
              <th className={`${thL} w-20`}>수급자</th>
              <td className={`${td}${ec(ed.name)}`}><Inline value={ed.name} onChange={(v) => update("name", v)} editing={editing} /></td>
              <th className={`${thL} w-16`}>성별</th>
              <td className={`${td}${ec(ed.gender)}`}>
                <Cb on={ed.gender === "M"} label="남" onToggle={() => pick("gender", "M")} editing={editing} />
                <Cb on={ed.gender === "F"} label="여" onToggle={() => pick("gender", "F")} editing={editing} />
              </td>
              <th className={`${thL} w-20`}>생년월일</th>
              <td className={`${td}${ec(ed.birth_date)}`}><Inline value={ed.birth_date} onChange={(v) => update("birth_date", v)} editing={editing} /></td>
              <th className={`${thL} w-14`}>등급</th>
              <td className={`${td}${ec(ed.grade)}`}><Inline value={ed.grade} onChange={(v) => update("grade", v)} editing={editing} width="5rem" /></td>
            </tr>
            <tr>
              <th className={thL}>학력</th>
              <td className={`${td}${ec(ed.education)}`}><Inline value={ed.education} onChange={(v) => update("education", v)} editing={editing} /></td>
              <th className={thL}>종교</th>
              <td className={`${td}${ec(ed.religion)}`}><Inline value={ed.religion} onChange={(v) => update("religion", v)} editing={editing} /></td>
              <th className={thL}>혈액형</th>
              <td className={`${td}${ec(ed.blood_type)}`}><Inline value={ed.blood_type} onChange={(v) => update("blood_type", v)} editing={editing} /></td>
              <th className={thL}>고향</th>
              <td className={`${td}${ec(ed.hometown)}`}><Inline value={ed.hometown} onChange={(v) => update("hometown", v)} editing={editing} /></td>
            </tr>
            <tr>
              <th className={thL}>경제상태</th>
              <td className={`${td}${ec(ed.economic_status)}`} colSpan={2}>
                <Cb on={ed.economic_status === "일반"} label="일반" onToggle={() => pick("economic_status", "일반")} editing={editing} />
                <Cb on={ed.economic_status === "경감"} label="경감" onToggle={() => pick("economic_status", "경감")} editing={editing} />
                <Cb on={ed.economic_status === "기초"} label="기초" onToggle={() => pick("economic_status", "기초")} editing={editing} />
              </td>
              <th className={thL}>키/체중</th>
              <td className={`${td}${ecAny(ed.height_cm, ed.weight_kg)}`} colSpan={2}>
                <Inline value={ed.height_cm} onChange={(v) => update("height_cm", v ? Number(v) : null)} editing={editing} width="3.5rem" />cm /
                <Inline value={ed.weight_kg} onChange={(v) => update("weight_kg", v ? Number(v) : null)} editing={editing} width="3.5rem" />kg
              </td>
              <th className={thL}>배우자</th>
              <td className={`${td}${ec(ed.spouse)}`}>
                <Cb on={ed.spouse === true} label="유" onToggle={() => update("spouse", ed.spouse === true ? null : true)} editing={editing} />
                <Cb on={ed.spouse === false} label="무" onToggle={() => update("spouse", ed.spouse === false ? null : false)} editing={editing} />
              </td>
            </tr>

            <tr>
              <th className={thL} rowSpan={2}>보호자</th>
              <th className={thL}>성 명</th>
              <td className={`${td}${ec(ed.guardian_name)}`} colSpan={2}><Inline value={ed.guardian_name} onChange={(v) => update("guardian_name", v)} editing={editing} /></td>
              <th className={thL}>자녀수</th>
              <th className={thL}>연락처</th>
              <td className={`${td}${ec(ed.guardian_phone)}`} colSpan={3}><Block value={ed.guardian_phone} onChange={(v) => update("guardian_phone", v)} editing={editing} rows={2} /></td>
            </tr>
            <tr>
              <th className={thL}>주수발자</th>
              <td className={`${td}${ec(ed.primary_caregiver)}`}><Inline value={ed.primary_caregiver} onChange={(v) => update("primary_caregiver", v)} editing={editing} placeholder="이름" /></td>
              <td className={`${td}${ec(ed.guardian_relation)}`}><Inline value={ed.guardian_relation} onChange={(v) => update("guardian_relation", v)} editing={editing} placeholder="관계" /></td>
              <td className={`${td}${ec(ed.num_children)}`}><Inline value={ed.num_children} onChange={(v) => update("num_children", v)} editing={editing} placeholder="예: 2남 2녀" /></td>
              <th className={thL}>동거여부</th>
              <td className={`${td}${ec(ed.cohabit_type)}`} colSpan={3}>
                <Cb on={ed.cohabit_type === "유"} label="유" onToggle={() => update("cohabit_type", ed.cohabit_type === "유" ? null : "유")} editing={editing} />
                <Cb on={ed.cohabit_type === "무"} label="무" onToggle={() => update("cohabit_type", ed.cohabit_type === "무" ? null : "무")} editing={editing} />
                <Cb on={ed.cohabit_type === "왕래"} label="왕래" onToggle={() => update("cohabit_type", ed.cohabit_type === "왕래" ? null : "왕래")} editing={editing} />
                <span className="ml-1">(<Inline value={ed.cohabit} onChange={(v) => update("cohabit", v)} editing={editing} width="14rem" placeholder="주1~2회 등" />)</span>
              </td>
            </tr>

            <tr>
              <th className={thL} rowSpan={3}>일상<br/>생활</th>
              <th className={thL}>보 행</th>
              <td className={`${td}${ec(walk)}`} colSpan={3}>
                <Cb on={walk === "자립"} label="자립" onToggle={() => pick("walking", "자립")} editing={editing} />
                <Cb on={walk === "도움"} label="도움" onToggle={() => pick("walking", "도움")} editing={editing} />
                <Cb on={walk === "완전도움"} label="완전도움" onToggle={() => pick("walking", "완전도움")} editing={editing} />
              </td>
              <th className={thL}>식 사</th>
              <td className={`${td}${ec(eat)}`} colSpan={3}>
                <Cb on={eat === "자립"} label="자립" onToggle={() => pick("eating", "자립")} editing={editing} />
                <Cb on={eat === "도움"} label="도움" onToggle={() => pick("eating", "도움")} editing={editing} />
                <Cb on={eat === "완전도움"} label="완전도움" onToggle={() => pick("eating", "완전도움")} editing={editing} />
              </td>
            </tr>
            <tr>
              <th className={thL}>정 서</th>
              <td className={`${td}${ec(emo)}`} colSpan={3}>
                <Cb on={emo === "안정됨"} label="안정됨" onToggle={() => pick("emotion", "안정됨")} editing={editing} />
                <Cb on={emo === "조금불안"} label="조금불안" onToggle={() => pick("emotion", "조금불안")} editing={editing} />
                <Cb on={emo === "불안정"} label="불안정" onToggle={() => pick("emotion", "불안정")} editing={editing} />
              </td>
              <th className={thL}>용 변</th>
              <td className={`${td}${ec(toi)}`} colSpan={3}>
                <Cb on={toi === "자립"} label="자립" onToggle={() => pick("toilet", "자립")} editing={editing} />
                <Cb on={toi === "도움"} label="도움" onToggle={() => pick("toilet", "도움")} editing={editing} />
                <Cb on={toi === "완전도움(기저귀)"} label="완전도움(기저귀)" onToggle={() => pick("toilet", "완전도움(기저귀)")} editing={editing} />
              </td>
            </tr>
            <tr>
              <th className={thL}>개인성향</th>
              <td className={`${td}${ec(per)}`} colSpan={3}>
                <Cb on={per === "적극"} label="적극" onToggle={() => pick("personality", "적극")} editing={editing} />
                <Cb on={per === "보통"} label="보통" onToggle={() => pick("personality", "보통")} editing={editing} />
                <Cb on={per === "조용"} label="조용" onToggle={() => pick("personality", "조용")} editing={editing} />
              </td>
              <th className={thL}>습 관</th>
              <td className={`${td}${ec(ed.habit)}`} colSpan={3}>
                <Cb on={hasHabit("음주")} label="음주" onToggle={() => toggleHabit("음주")} editing={editing} />
                <Cb on={hasHabit("흡연")} label="흡연" onToggle={() => toggleHabit("흡연")} editing={editing} />
                <Cb on={hasHabit("수면")} label="수면" onToggle={() => toggleHabit("수면")} editing={editing} />
                <Cb on={hasHabit("기타")} label="기타" onToggle={() => toggleHabit("기타")} editing={editing} />
              </td>
            </tr>

            <tr>
              <th className={thL} rowSpan={3}>영양</th>
              <th className={thL}>치 아</th>
              <td className={`${td}${ec(ed.dentition)}`} colSpan={7}>
                <Cb on={/유/.test(ed.dentition ?? "")} label="유" onToggle={() => update("dentition", /유/.test(ed.dentition ?? "") ? "" : "유")} editing={editing} />
                <span className="text-sm">(상 <Inline value={ed.dentition_upper} onChange={(v) => update("dentition_upper", v)} editing={editing} width="2.5rem" />개, 하 <Inline value={ed.dentition_lower} onChange={(v) => update("dentition_lower", v)} editing={editing} width="2.5rem" />개)</span>
                <Cb on={ed.dentition === "무"} label="무" onToggle={() => pick("dentition", "무")} editing={editing} />
                <Cb on={/잔존치아/.test(ed.dentition ?? "")} label="잔존치아" onToggle={() => update("dentition", /잔존치아/.test(ed.dentition ?? "") ? "" : "잔존치아")} editing={editing} />
                <Cb on={/기타/.test(ed.dentition ?? "")} label="기타" onToggle={() => update("dentition", /기타/.test(ed.dentition ?? "") ? "" : `기타 ${ed.dentition_other ?? ""}`)} editing={editing} />
                <Inline value={ed.dentition_other} onChange={(v) => update("dentition_other", v)} editing={editing} width="14rem" />
              </td>
            </tr>
            <tr>
              <th className={thL}>배 변</th>
              <td className={`${td}${ec(bow)}`} colSpan={7}>
                <Cb on={bow === "정상"} label="정상" onToggle={() => pick("bowel", "정상")} editing={editing} />
                <Cb on={bow === "설사"} label="설사" onToggle={() => pick("bowel", "설사")} editing={editing} />
                <Cb on={bow === "변비"} label="변비" onToggle={() => pick("bowel", "변비")} editing={editing} />
                <Inline value={ed.bowel_note} onChange={(v) => update("bowel_note", v)} editing={editing} width="10rem" placeholder="예: 주1회 배변" />
                <Cb on={bow === "기저귀"} label="기저귀" onToggle={() => pick("bowel", "기저귀")} editing={editing} />
                <Cb on={bow === "소변주머니착용"} label="소변주머니착용" onToggle={() => pick("bowel", "소변주머니착용")} editing={editing} />
                <Cb on={bow === "변실금(기저귀착용)"} label="변실금(기저귀착용)" onToggle={() => pick("bowel", "변실금(기저귀착용)")} editing={editing} />
              </td>
            </tr>
            <tr>
              <th className={thL}>식 사</th>
              <td className={`${td}${ec(meal)}`} colSpan={7}>
                <Cb on={meal === "일반식"} label="일반식" onToggle={() => pick("meal_form", "일반식")} editing={editing} />
                <span className="text-sm mr-2">(<Cb on={ed.meal_soft === true} label="다짐 찬" onToggle={() => update("meal_soft", ed.meal_soft === true ? null : true)} editing={editing} />)</span>
                <Cb on={meal === "유동식(죽)"} label="유동식(죽)" onToggle={() => pick("meal_form", "유동식(죽)")} editing={editing} />
                <Cb on={meal === "경관식"} label="경관식" onToggle={() => pick("meal_form", "경관식")} editing={editing} />
                <span className="ml-2 inline-flex items-baseline gap-1">
                  <Cb on={!!ed.meal_note} label="" onToggle={() => update("meal_note", ed.meal_note ? "" : " ")} editing={editing} />
                  <Inline value={ed.meal_note} onChange={(v) => update("meal_note", v)} editing={editing} width="18rem" placeholder="부연 설명" />
                </span>
              </td>
            </tr>

            <tr>
              <th className={thL} rowSpan={3}>회화</th>
              <th className={thL}>보 기</th>
              <td className={`${td}${ec(visionVal)}`} colSpan={7}>
                <Cb on={visionVal === "양호"} label="양호" onToggle={() => pick("vision", "양호")} editing={editing} />
                <Cb on={visionVal === "불가능"} label="불가능" onToggle={() => pick("vision", "불가능")} editing={editing} />
                <span className="text-sm mr-2">(
                  <Cb on={ed.vision_side === "좌"} label="좌" onToggle={() => pick("vision_side", "좌")} editing={editing} />
                  <Cb on={ed.vision_side === "우"} label="우" onToggle={() => pick("vision_side", "우")} editing={editing} />
                )</span>
                <Cb on={/안경/.test(visionVal)} label="안경착용" onToggle={() => update("vision", /안경/.test(visionVal) ? "" : "안경착용")} editing={editing} />
                <span className="inline-flex items-baseline gap-1">
                  <Cb on={!!ed.vision_note} label="" onToggle={() => update("vision_note", ed.vision_note ? "" : " ")} editing={editing} />
                  <Inline value={ed.vision_note} onChange={(v) => update("vision_note", v)} editing={editing} width="22rem" placeholder="특이사항" />
                </span>
              </td>
            </tr>
            <tr>
              <th className={thL}>듣 기</th>
              <td className={`${td}${ec(hearingVal)}`} colSpan={7}>
                <Cb on={hearingVal === "양호"} label="양호" onToggle={() => pick("hearing", "양호")} editing={editing} />
                <Cb on={/큰소리/.test(hearingVal)} label="큰소리로 말할 경우 가능" onToggle={() => update("hearing", /큰소리/.test(hearingVal) ? "" : "큰소리로 말할 경우 가능")} editing={editing} />
                <Cb on={hearingVal === "불가능"} label="불가능" onToggle={() => pick("hearing", "불가능")} editing={editing} />
                <span className="text-sm mr-2">(
                  <Cb on={ed.hearing_side === "좌"} label="좌" onToggle={() => pick("hearing_side", "좌")} editing={editing} />
                  <Cb on={ed.hearing_side === "우"} label="우" onToggle={() => pick("hearing_side", "우")} editing={editing} />
                )</span>
                <Cb on={/보청기/.test(hearingVal)} label="보청기 착용" onToggle={() => update("hearing", /보청기/.test(hearingVal) ? "" : "보청기 착용")} editing={editing} />
                <Cb on={ed.hearing_tinnitus === true} label="이명있음" onToggle={() => update("hearing_tinnitus", ed.hearing_tinnitus === true ? false : true)} editing={editing} />
              </td>
            </tr>
            <tr>
              <th className={thL}>말하기</th>
              <td className={`${td}${ec(speechVal)}`} colSpan={7}>
                <Cb on={speechVal === "양호"} label="양호" onToggle={() => pick("speech", "양호")} editing={editing} />
                <Cb on={/묻는/.test(speechVal)} label="묻는 말에만 대답이 가능" onToggle={() => update("speech", /묻는/.test(speechVal) ? "" : "묻는 말에만 대답이 가능")} editing={editing} />
                <Cb on={speechVal === "불가능"} label="불가능" onToggle={() => pick("speech", "불가능")} editing={editing} />
              </td>
            </tr>

            <tr>
              <th className={thL} colSpan={2}>서비스 이용현황</th>
              <td className={`${td}${ec(svc)}`} colSpan={7}>
                <Cb on={svc === "없음"} label="없음" onToggle={() => pick("service_use", "없음")} editing={editing} />
                <Cb on={/주간보호센터/.test(svc)} label="타 주간보호센터" onToggle={() => update("service_use", /주간보호센터/.test(svc) ? "" : "타 주간보호센터")} editing={editing} />
                <Cb on={/기관/.test(svc)} label="타 기관" onToggle={() => update("service_use", /기관/.test(svc) ? "" : "타 기관")} editing={editing} />
                <Inline value={ed.service_use_other} onChange={(v) => update("service_use_other", v)} editing={editing} width="14rem" />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <th className={`${thL} w-12`} rowSpan={2}>병<br/>력</th>
              <th className={`${thL} w-20`}>발병시기</th>
              <td className={`${td}${ec(ed.disease_history)}`} colSpan={3}><Block value={ed.disease_history} onChange={(v) => update("disease_history", v)} editing={editing} rows={3} /></td>
            </tr>
            <tr>
              <th className={thL}>완치상태</th>
              <td className={`${td}${ec(ed.cure_status)}`}><Inline value={ed.cure_status} onChange={(v) => update("cure_status", v)} editing={editing} width="14rem" /></td>
              <th className={`${thL} w-20`}>주의료기관</th>
              <td className={`${td}${ec(ed.main_hospital)}`}><Inline value={ed.main_hospital} onChange={(v) => update("main_hospital", v)} editing={editing} width="14rem" /></td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse mb-3">
          <tbody>
            {DISEASE_CATEGORIES.map((cat, idx) => (
              <tr key={cat.left.name}>
                {idx === 0 && (
                  <th className={`${thL} w-12`} rowSpan={DISEASE_CATEGORIES.length + 1}>질<br/>환</th>
                )}
                <th className={`${thL} w-24`}>{cat.left.name}</th>
                <td className={`${td}${cat.left.items.some((it) => hasDisease(it)) ? "" : " empty-mark"}`}>
                  {cat.left.items.map((it) => (
                    <Cb key={it} on={hasDisease(it)} label={it} onToggle={() => toggleDisease(it)} editing={editing} />
                  ))}
                </td>
                <th className={`${thL} w-24`}>{cat.right.name}</th>
                <td className={`${td}${cat.right.items.some((it) => hasDisease(it)) ? "" : " empty-mark"}`}>
                  {cat.right.items.map((it) => (
                    <Cb key={it} on={hasDisease(it)} label={it} onToggle={() => toggleDisease(it)} editing={editing} />
                  ))}
                </td>
              </tr>
            ))}
            <tr>
              <th className={thL}>기타질환</th>
              <td className={`${td}${ec(ed.other_diseases)}`}><Inline value={ed.other_diseases} onChange={(v) => update("other_diseases", v)} editing={editing} width="24rem" /></td>
              <th className={thL}>복용약</th>
              <td className={`${td}${ec(ed.medications)}`}><Inline value={ed.medications} onChange={(v) => update("medications", v)} editing={editing} width="24rem" /></td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <th className={`${thL} w-24`}>개별욕구</th>
              <td className={`${td}${ec(ed.individual_needs)}`}><Block value={ed.individual_needs} onChange={(v) => update("individual_needs", v)} editing={editing} rows={3} /></td>
            </tr>
            <tr>
              <th className={thL}>상담자의견</th>
              <td className={`${td}${ec(ed.counselor_opinion)}`}><Block value={ed.counselor_opinion} onChange={(v) => update("counselor_opinion", v)} editing={editing} rows={4} /></td>
            </tr>
          </tbody>
        </table>

        <p className="text-center text-sm mt-6">{CENTER_INFO.name}</p>

      </article>

      {!editing && (
        <div className="no-print max-w-5xl mx-auto px-4 pb-20">
          <div className="bg-white border rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> AI로 수정 — 원하는 변경을 자연어로 입력
            </p>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="예: 개별욕구 더 구체적으로 / 주요 질환에 고혈압 추가"
              rows={2}
              className="w-full border rounded-lg p-2 text-sm"
            />
            <button
              onClick={refine}
              disabled={refining || !chatInput.trim()}
              className="w-full min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {refining ? <><Loader2 className="w-4 h-4 animate-spin" /> 적용 중...</> : "적용"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
