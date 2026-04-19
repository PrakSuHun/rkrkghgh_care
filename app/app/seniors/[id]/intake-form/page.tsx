"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, Wand2, Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { CENTER_INFO } from "@/lib/centerInfo";

const WRITER_LABELS = new Set(["기록자", "상담자", "상담자명", "사회복지사"]);

function WriterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = CENTER_INFO.socialWorkers;
  const isKnown = options.includes(value);
  return (
    <div className="inline-flex items-center gap-1">
      <select
        className="border rounded px-1 py-0.5 text-sm bg-yellow-50"
        value={isKnown ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">(직접 입력)</option>
        {options.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      {!isKnown && (
        <input
          type="text"
          className="border rounded px-1 py-0.5 text-sm bg-yellow-50"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function Cell({ value, onChange, editing, multiline, rows = 2, label, placeholder }: { value: any; onChange: (v: any) => void; editing: boolean; multiline?: boolean; rows?: number; label?: string; placeholder?: string }) {
  const text = value == null ? "" : typeof value === "boolean" ? (value ? "유" : "무") : Array.isArray(value) ? value.join(", ") : String(value);
  if (!editing) return <span className="text-sm whitespace-pre-wrap">{text || <span className="text-gray-300">{placeholder ?? "-"}</span>}</span>;
  if (label && WRITER_LABELS.has(label) && !multiline) return <WriterSelect value={text} onChange={onChange} />;
  if (multiline) {
    return (
      <textarea
        className="w-full border rounded px-2 py-1 text-sm bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        rows={rows}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className="w-full border rounded px-2 py-1 text-sm bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function IntakeFormPage() {
  const { id: seniorId } = useParams() as { id: string };
  const router = useRouter();
  const { data, mutate } = useSWR<any>(`/api/intake-forms?senior_id=${seniorId}`);
  const intake = data?.intakes?.[0];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
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

  const ed = editing && draft ? draft : (intake.extracted_data ?? {});
  const update = (key: string, val: any) => setDraft((prev: any) => ({ ...(prev ?? intake.extracted_data ?? {}), [key]: val }));

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

  const row = (label: string, children: React.ReactNode, thClass = "") => (
    <tr>
      <th className={`border border-black bg-gray-50 px-2 py-2 text-center text-xs font-medium ${thClass}`}>{label}</th>
      <td className="border border-black px-2 py-2 text-sm">{children}</td>
    </tr>
  );

  return (
    <>
      <div className="no-print px-4 py-3 max-w-4xl mx-auto flex items-center justify-between gap-2">
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

      <article className="print-sheet max-w-4xl mx-auto bg-white border rounded-xl p-6 sm:p-10 mb-4">
        <header className="text-center border-b-2 border-black pb-3 mb-5">
          <h1 className="text-2xl font-bold">초기상담기록지</h1>
          <p className="text-sm text-gray-600 mt-1">{CENTER_INFO.name}</p>
        </header>

        <table className="w-full border-collapse mb-4">
          <tbody>
            {row("상담일자", <Cell value={ed.counseling_date} onChange={(v) => update("counseling_date", v)} editing={editing} />)}
            {row("기록자", <Cell value={ed.counselor_name} onChange={(v) => update("counselor_name", v)} editing={editing} label="기록자" />)}
          </tbody>
        </table>

        <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-2">1. 인적사항</h2>
        <table className="w-full border-collapse mb-4">
          <tbody>
            {row("성명", <Cell value={ed.name} onChange={(v) => update("name", v)} editing={editing} />)}
            {row("성별", <Cell value={ed.gender} onChange={(v) => update("gender", v)} editing={editing} placeholder="M / F" />)}
            {row("생년월일", <Cell value={ed.birth_date} onChange={(v) => update("birth_date", v)} editing={editing} />)}
            {row("장기요양등급", <Cell value={ed.grade} onChange={(v) => update("grade", v)} editing={editing} />)}
            {row("학력", <Cell value={ed.education} onChange={(v) => update("education", v)} editing={editing} />)}
            {row("혈액형", <Cell value={ed.blood_type} onChange={(v) => update("blood_type", v)} editing={editing} />)}
            {row("고향", <Cell value={ed.hometown} onChange={(v) => update("hometown", v)} editing={editing} />)}
            {row("경제상태", <Cell value={ed.economic_status} onChange={(v) => update("economic_status", v)} editing={editing} />)}
            {row("신장(cm)", <Cell value={ed.height_cm} onChange={(v) => update("height_cm", v ? Number(v) : null)} editing={editing} />)}
            {row("체중(kg)", <Cell value={ed.weight_kg} onChange={(v) => update("weight_kg", v ? Number(v) : null)} editing={editing} />)}
            {row("배우자", <Cell value={ed.spouse} onChange={(v) => update("spouse", v === "유" ? true : v === "무" ? false : v)} editing={editing} placeholder="유 / 무" />)}
            {row("자녀수", <Cell value={ed.num_children} onChange={(v) => update("num_children", v)} editing={editing} />)}
            {row("동거여부", <Cell value={ed.cohabit} onChange={(v) => update("cohabit", v)} editing={editing} />)}
          </tbody>
        </table>

        <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-2">2. 보호자</h2>
        <table className="w-full border-collapse mb-4">
          <tbody>
            {row("보호자 성명", <Cell value={ed.guardian_name} onChange={(v) => update("guardian_name", v)} editing={editing} />)}
            {row("관계", <Cell value={ed.guardian_relation} onChange={(v) => update("guardian_relation", v)} editing={editing} />)}
            {row("연락처", <Cell value={ed.guardian_phone} onChange={(v) => update("guardian_phone", v)} editing={editing} />)}
          </tbody>
        </table>

        <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-2">3. 일상생활 및 신체상태</h2>
        <table className="w-full border-collapse mb-4">
          <tbody>
            {row("보행상태", <Cell value={ed.walking} onChange={(v) => update("walking", v)} editing={editing} placeholder="자립/도움/완전도움" />)}
            {row("정서상태", <Cell value={ed.emotion} onChange={(v) => update("emotion", v)} editing={editing} />)}
            {row("성격", <Cell value={ed.personality} onChange={(v) => update("personality", v)} editing={editing} />)}
            {row("생활습관", <Cell value={ed.habit} onChange={(v) => update("habit", v)} editing={editing} />)}
            {row("식사도움", <Cell value={ed.eating} onChange={(v) => update("eating", v)} editing={editing} placeholder="자립/도움/완전도움" />)}
            {row("배변/배뇨", <Cell value={ed.toilet} onChange={(v) => update("toilet", v)} editing={editing} />)}
            {row("치아상태", <Cell value={ed.dentition} onChange={(v) => update("dentition", v)} editing={editing} />)}
            {row("배변상태", <Cell value={ed.bowel} onChange={(v) => update("bowel", v)} editing={editing} />)}
            {row("식사형태", <Cell value={ed.meal_form} onChange={(v) => update("meal_form", v)} editing={editing} />)}
            {row("시력", <Cell value={ed.vision} onChange={(v) => update("vision", v)} editing={editing} />)}
            {row("청력", <Cell value={ed.hearing} onChange={(v) => update("hearing", v)} editing={editing} />)}
            {row("언어", <Cell value={ed.speech} onChange={(v) => update("speech", v)} editing={editing} />)}
            {row("타 서비스 이용", <Cell value={ed.service_use} onChange={(v) => update("service_use", v)} editing={editing} />)}
          </tbody>
        </table>

        <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-2">4. 건강상태</h2>
        <table className="w-full border-collapse mb-4">
          <tbody>
            {row("질환", <Cell value={ed.diseases} onChange={(v) => update("diseases", String(v).split(",").map((s) => s.trim()).filter(Boolean))} editing={editing} placeholder="쉼표로 구분" />)}
            {row("주의료기관", <Cell value={ed.main_hospital} onChange={(v) => update("main_hospital", v)} editing={editing} />)}
            {row("복용약", <Cell value={ed.medications} onChange={(v) => update("medications", v)} editing={editing} multiline rows={2} />)}
            {row("발병/병력", <Cell value={ed.disease_history} onChange={(v) => update("disease_history", v)} editing={editing} multiline rows={5} />)}
          </tbody>
        </table>

        <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-2">5. 개별욕구 및 상담자 의견</h2>
        <table className="w-full border-collapse mb-4">
          <tbody>
            {row("개별욕구", <Cell value={ed.individual_needs} onChange={(v) => update("individual_needs", v)} editing={editing} multiline rows={4} />)}
            {row("상담자 의견", <Cell value={ed.counselor_opinion} onChange={(v) => update("counselor_opinion", v)} editing={editing} multiline rows={5} />)}
          </tbody>
        </table>

        <div className="text-center text-sm mt-6">
          <p>{ed.counseling_date ?? ""}</p>
          <p className="mt-2">기록자 : {ed.counselor_name ?? ""} &nbsp; (서명)</p>
        </div>

        <footer className="mt-8 pt-4 border-t text-xs text-gray-500 text-right no-print">
          생성일: {new Date(intake.created_at).toLocaleDateString("ko-KR")}
        </footer>
      </article>

      {!editing && (
        <div className="no-print max-w-4xl mx-auto px-4 pb-20">
          <div className="bg-white border rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> AI로 수정 — 원하는 변경을 자연어로 입력
            </p>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="예: 복용약에 수면제 추가 / 개별욕구 더 구체적으로"
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
