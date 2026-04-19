"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, RefreshCw, Loader2, Save, Wand2 } from "lucide-react";

type Dict = Record<string, any>;

// ---------- editable helpers ----------
function Cb({ on, label, onToggle }: { on: boolean; label: string; onToggle?: () => void }) {
  return (
    <span className="nf-cb inline-flex items-baseline gap-1" onClick={onToggle}>
      <span className="text-base leading-none">{on ? "■" : "□"}</span>
      <span>{label}</span>
    </span>
  );
}

function EditInline({ value, onChange, placeholder, width }: { value: any; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return (
    <input
      type="text"
      className="nf-edit-inline"
      style={width ? { minWidth: width } : undefined}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function EditText({ value, onChange, rows = 3, heightMm, maxLen }: { value: any; onChange: (v: string) => void; rows?: number; heightMm?: number; maxLen?: number }) {
  const len = (value ?? "").length;
  const cap = maxLen ?? 200;
  const fontPt = len > cap * 2 ? 7 : len > cap * 1.5 ? 8 : len > cap ? 9 : 10;
  return (
    <textarea
      className="nf-edit-text"
      rows={rows}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        resize: "none",
        overflow: "hidden",
        height: heightMm ? `${heightMm}mm` : undefined,
        fontSize: `${fontPt}pt`,
        lineHeight: 1.25,
      }}
    />
  );
}

function ScoreCell({ current, value, onChange }: { current: number; value: number; onChange: (v: number) => void }) {
  return (
    <td className={`nf-score-cell ${current === value ? "on" : ""}`} onClick={() => onChange(value)}>
      {current === value ? "✓" : ""}
    </td>
  );
}

// ---------- page ----------
export default function NeedsAssessmentFullPage() {
  const { id } = useParams() as { id: string };
  const sp = useSearchParams();
  const backUrl = sp.get("from") === "documents" ? "/documents" : `/seniors/${id}`;
  const backLabel = sp.get("from") === "documents" ? "서류 목록" : "대상자로";
  const { data: seniorRes } = useSWR<any>(`/api/seniors/${id}`);
  const [full, setFull] = useState<Dict | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    if (seniorRes?.senior?.needs_assessment_full) {
      setFull(seniorRes.senior.needs_assessment_full);
      setDirty(false);
    }
  }, [seniorRes?.senior?.needs_assessment_full]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // 빈 셀 자동 표시 — td/nf-row/standalone textarea 모두 스캔
  useEffect(() => {
    if (!full) return;
    const checkContainer = (el: Element) => {
      if (el.classList.contains("skip-empty-mark")) { el.classList.remove("empty-mark"); return; }
      const inputs = el.querySelectorAll<HTMLInputElement>(".nf-edit-inline");
      const texts = el.querySelectorAll<HTMLTextAreaElement>(".nf-edit-text");
      const cbs = el.querySelectorAll(".nf-cb");
      const total = inputs.length + texts.length + cbs.length;
      if (total === 0) { el.classList.remove("empty-mark"); return; }
      const anyInput = Array.from(inputs).some((i) => i.value.trim() !== "");
      const anyText = Array.from(texts).some((t) => t.value.trim() !== "");
      const anyCb = Array.from(cbs).some((c) => (c.textContent ?? "").includes("■"));
      el.classList.toggle("empty-mark", !anyInput && !anyText && !anyCb);
    };
    const rescan = () => {
      const sheet = document.querySelector(".nf-sheet");
      if (!sheet) return;
      sheet.querySelectorAll<HTMLTableCellElement>("td").forEach((cell) => {
        if (cell.classList.contains("nf-score-cell")) return;
        checkContainer(cell);
      });
      sheet.querySelectorAll<HTMLElement>(".nf-row").forEach(checkContainer);
      sheet.querySelectorAll<HTMLElement>(".nf-free > .nf-edit-text").forEach((t) => {
        const ta = t as HTMLTextAreaElement;
        t.classList.toggle("empty-mark", (ta.value ?? "").trim() === "");
      });
      sheet.querySelectorAll<HTMLTableRowElement>("tr").forEach((row) => {
        const scores = row.querySelectorAll<HTMLTableCellElement>(".nf-score-cell");
        if (scores.length === 0) return;
        const hasOn = Array.from(scores).some((s) => s.classList.contains("on"));
        scores.forEach((s) => s.classList.toggle("empty-mark", !hasOn));
      });
    };
    const t = setTimeout(rescan, 50);
    const interval = setInterval(rescan, 800);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [full]);

  const update = (path: string[], value: any) => {
    if (!full) return;
    const next = structuredClone(full);
    let ref: any = next;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in ref)) ref[path[i]] = {};
      ref = ref[path[i]];
    }
    ref[path[path.length - 1]] = value;
    setFull(next);
    setDirty(true);
  };

  const updateToggle = (path: string[], value: any) => {
    if (!full) return;
    let cur: any = full;
    for (const p of path) cur = cur?.[p];
    update(path, cur === value ? null : value);
  };

  const toggleInArray = (path: string[], item: string) => {
    if (!full) return;
    const next = structuredClone(full);
    let ref: any = next;
    for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]] ?? (ref[path[i]] = {});
    const arr: string[] = Array.isArray(ref[path[path.length - 1]]) ? [...ref[path[path.length - 1]]] : [];
    const idx = arr.indexOf(item);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(item);
    ref[path[path.length - 1]] = arr;
    setFull(next);
    setDirty(true);
  };

  const save = async () => {
    if (!full) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/seniors/${id}/needs-assessment`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needs_assessment_full: full }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setDirty(false);
      globalMutate(`/api/seniors/${id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    if (full && !confirm("AI로 다시 생성하면 직접 수정한 내용이 덮어써집니다. 진행할까요?")) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/seniors/${id}/needs-assessment/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra: {} }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setFull(j.data);
      setDirty(false);
      globalMutate(`/api/seniors/${id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!seniorRes) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  const senior = seniorRes.senior;

  if (!full) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center space-y-4">
        <Link href={backUrl} className="inline-flex items-center text-sm text-gray-600"><ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}</Link>
        <p className="text-gray-500">욕구조사기록지가 아직 생성되지 않았습니다.</p>
        <button onClick={generate} disabled={generating} className="min-h-[44px] px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 작성 중 (1~3분)...</> : "AI로 생성"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="no-print px-4 py-3 max-w-5xl mx-auto flex items-center justify-between gap-2">
        <Link href={backUrl} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
        </Link>
        <div className="flex gap-2 items-center">
          {dirty && <span className="text-xs text-amber-600">변경사항 있음</span>}
          <button onClick={save} disabled={saving || !dirty} className="min-h-[40px] px-3 py-2 bg-green-600 text-white active:bg-green-800 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
          </button>
          <button onClick={generate} disabled={generating} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} /> 재생성
          </button>
          <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
            <Printer className="w-4 h-4" /> 인쇄
          </button>
        </div>
      </div>

      <article className="print-sheet nf-sheet max-w-5xl mx-auto bg-white border p-6 sm:p-10 mb-4">
        <Page1 d={full} u={update} ut={updateToggle} t={toggleInArray} />
        <Page2 d={full} u={update} ut={updateToggle} t={toggleInArray} />
        <Page3 d={full} u={update} ut={updateToggle} t={toggleInArray} />
        <Page4 d={full} u={update} ut={updateToggle} t={toggleInArray} />
        <Page5 d={full} u={update} ut={updateToggle} t={toggleInArray} />
      </article>

      <div className="no-print max-w-5xl mx-auto px-4 pb-20">
        <div className="bg-white border rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> AI로 수정 — 원하는 변경을 자연어로 입력
          </p>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="예: 식사 영양 의견을 좀 더 구체적으로 / 인지기능 항목에 치매 체크해줘 / 종합의견 간결하게"
            rows={2}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <button
            onClick={async () => {
              if (!chatInput.trim()) return;
              setRefining(true);
              try {
                const res = await fetch(`/api/seniors/${id}/needs-assessment/refine`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ instruction: chatInput }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error);
                setFull(j.data);
                setDirty(false);
                setChatInput("");
                globalMutate(`/api/seniors/${id}`);
              } catch (e: any) {
                alert(e.message);
              } finally {
                setRefining(false);
              }
            }}
            disabled={refining || !chatInput.trim()}
            className="w-full min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {refining ? <><Loader2 className="w-4 h-4 animate-spin" /> 적용 중...</> : "적용"}
          </button>
        </div>
      </div>

    </>
  );
}

// ============== PAGE 1 ==============
function Page1({ d, u, ut, t }: { d: Dict; u: (p: string[], v: any) => void; ut: (p: string[], v: any) => void; t: (p: string[], i: string) => void }) {
  const h = d.header ?? {};
  const s1 = d.section1_general ?? {};
  const s2 = d.section2_health ?? {};
  const dis = s2.diseases ?? {};
  const surveyTypes = ["최초", "정기", "상태변화", "기타"];

  return (
    <section className="nf-page">
      <div className="nf-page-num">1 / 5</div>
      <h1 className="nf-title">욕구조사기록지</h1>
      <p className="nf-notice">※ 작성자는 최근 1개월 시점의 수급자 상태를 종합하여 작성하여 주시기 바랍니다.</p>
      <p className="nf-notice">※ [ ], □에는 해당되는 곳에 ∨표기를 합니다.</p>

      <table className="nf-table mt-2">
        <tbody>
          <tr>
            <th className="w-20">기관명</th><td><EditInline value={h.center_name} onChange={(v) => u(["header", "center_name"], v)} /></td>
            <th className="w-20">기관기호</th><td><EditInline value={h.center_code} onChange={(v) => u(["header", "center_code"], v)} /></td>
            <th className="w-16">작성일</th><td><EditInline value={h.written_at} onChange={(v) => u(["header", "written_at"], v)} /></td>
          </tr>
          <tr>
            <th>작성자 성명</th><td><EditInline value={h.writer_name} onChange={(v) => u(["header", "writer_name"], v)} /></td>
            <th>직종</th><td colSpan={3}><EditInline value={h.writer_role} onChange={(v) => u(["header", "writer_role"], v)} /></td>
          </tr>
          <tr>
            <th>욕구조사 유형</th>
            <td colSpan={5}>
              {surveyTypes.map((st) => (
                <Cb key={st} on={h.survey_type === st} label={st + (st === "기타" ? "(   )" : "")} onToggle={() => ut(["header", "survey_type"], st)} />
              ))}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="nf-section-bar">1. 일반사항</div>
      <table className="nf-table">
        <tbody>
          <tr>
            <th rowSpan={3} className="w-20 text-center">수급자</th>
            <th className="w-24">성명</th><td><EditInline value={s1.name} onChange={(v) => u(["section1_general", "name"], v)} /></td>
            <th className="w-20">성별</th>
            <td>
              <Cb on={s1.gender === "M"} label="남" onToggle={() => ut(["section1_general", "gender"], "M")} />
              <Cb on={s1.gender === "F"} label="여" onToggle={() => ut(["section1_general", "gender"], "F")} />
            </td>
          </tr>
          <tr>
            <th>장기요양인정번호</th><td><EditInline value={s1.long_term_care_id} onChange={(v) => u(["section1_general", "long_term_care_id"], v)} /></td>
            <th>장기요양등급</th><td><EditInline value={s1.grade} onChange={(v) => u(["section1_general", "grade"], v)} /></td>
          </tr>
          <tr>
            <th>생년월일</th>
            <td colSpan={3}>
              <EditInline value={s1.birth_date} onChange={(v) => u(["section1_general", "birth_date"], v)} /> (<EditInline value={s1.age} onChange={(v) => u(["section1_general", "age"], Number(v) || 0)} width={40} /> 세)
            </td>
          </tr>
          <tr>
            <th rowSpan={2} className="w-20 text-center">면담자</th>
            <td colSpan={4}>
              <Cb on={s1.interviewer_type === "수급자"} label="수급자" onToggle={() => ut(["section1_general", "interviewer_type"], "수급자")} />
            </td>
          </tr>
          <tr>
            <td>
              <Cb on={s1.interviewer_type === "보호자"} label="보호자" onToggle={() => ut(["section1_general", "interviewer_type"], "보호자")} />
            </td>
            <th>성명</th>
            <td><EditInline value={s1.interviewer_name} onChange={(v) => u(["section1_general", "interviewer_name"], v)} /></td>
            <th>주 수발자 여부</th>
            <td>
              <Cb on={!!s1.is_primary_caregiver} label="Y" onToggle={() => ut(["section1_general", "is_primary_caregiver"], true)} />
              <Cb on={s1.is_primary_caregiver === false} label="N" onToggle={() => ut(["section1_general", "is_primary_caregiver"], false)} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="nf-section-bar">2. 일반적 건강상태</div>
      <table className="nf-table">
        <tbody>
          <tr>
            <th className="w-20">키/체중</th>
            <td style={{ width: "26%" }}>키 <EditInline value={s2.height_cm} onChange={(v) => u(["section2_health", "height_cm"], Number(v) || 0)} width={50} /> cm</td>
            <td style={{ width: "26%" }}>체중 <EditInline value={s2.weight_kg} onChange={(v) => u(["section2_health", "weight_kg"], Number(v) || 0)} width={50} /> kg</td>
            <td colSpan={3}>BMI <EditInline value={s2.bmi} onChange={(v) => u(["section2_health", "bmi"], v)} width={60} /></td>
          </tr>
          <tr>
            <th className="w-24 nf-sub-ko" style={{ background: "#fafafa" }}>가. 보유질환</th>
            <td colSpan={5} className="skip-empty-mark">
              <Cb
                on={!((dis.neuro ?? []).length || (dis.cardio ?? []).length || (dis.endocrine ?? []).length || (dis.musculo ?? []).length || (dis.uro ?? []).length || (dis.sensory ?? []).length || (dis.infection ?? []).length || dis.other_cancer || dis.other_allergy || dis.other_other)}
                label="없음"
                onToggle={() => {
                  // 질환이 하나도 없을 때만 직접 토글 (의미 없음 — display only)
                  // 질환이 있으면 모두 지워서 '없음' 상태로 전환
                  const hasAny = (dis.neuro ?? []).length || (dis.cardio ?? []).length || (dis.endocrine ?? []).length || (dis.musculo ?? []).length || (dis.uro ?? []).length || (dis.sensory ?? []).length || (dis.infection ?? []).length || dis.other_cancer || dis.other_allergy || dis.other_other;
                  if (hasAny && confirm("체크된 모든 질환을 해제하시겠습니까?")) {
                    u(["section2_health", "diseases"], {
                      ...dis,
                      neuro: [], cardio: [], endocrine: [], musculo: [], uro: [], sensory: [], infection: [],
                      other_cancer: null, other_allergy: null, other_other: null,
                    });
                  }
                }}
              />
            </td>
          </tr>
          <DiseaseRow cat="뇌신경계" items={["뇌졸중(뇌출혈, 뇌경색증)", "치매", "파킨슨병", "우울증"]} path={["section2_health", "diseases", "neuro"]} data={dis.neuro ?? []} t={t} />
          <DiseaseRow cat="호흡·순환기계" items={["고혈압", "협심증", "심근경색증", "천식", "만성폐쇄성폐질환"]} path={["section2_health", "diseases", "cardio"]} data={dis.cardio ?? []} t={t} />
          <DiseaseRow cat="내분비·대사" items={["당뇨", "고지혈증"]} path={["section2_health", "diseases", "endocrine"]} data={dis.endocrine ?? []} t={t} />
          <DiseaseRow cat="근골격계" items={["관절염(퇴행성·류마티스)", "골다공증", "골절·탈골 등 사고로 인한 후유증"]} path={["section2_health", "diseases", "musculo"]} data={dis.musculo ?? []} t={t} />
          <DiseaseRow cat="비뇨생식기계" items={["만성신부전", "요로감염", "만성방광염", "전립선비대"]} path={["section2_health", "diseases", "uro"]} data={dis.uro ?? []} t={t} />
          <DiseaseRow cat="감각계" items={["백내장", "녹내장", "난청", "만성중이염", "이명"]} path={["section2_health", "diseases", "sensory"]} data={dis.sensory ?? []} t={t} />
          <tr>
            <th className="w-24">감염</th>
            <td colSpan={5}>
              <Cb on={(dis.infection ?? []).includes("결핵")} label="결핵" onToggle={() => t(["section2_health", "diseases", "infection"], "결핵")} />
              <Cb on={(dis.infection ?? []).includes("옴")} label="옴" onToggle={() => t(["section2_health", "diseases", "infection"], "옴")} />
              <Cb on={(dis.infection ?? []).includes("다약제내성균")} label="다약제내성균(종류: )" onToggle={() => t(["section2_health", "diseases", "infection"], "다약제내성균")} />
            </td>
          </tr>
          <tr>
            <th className="w-24">기타 질환</th>
            <td colSpan={5}>
              <div>
                <Cb on={!!dis.other_cancer} label="암 (진단명:" onToggle={() => ut(["section2_health", "diseases", "other_cancer"], dis.other_cancer ? null : "")} />
                <EditInline value={dis.other_cancer ?? ""} onChange={(v) => u(["section2_health", "diseases", "other_cancer"], v)} width={150} /> )
              </div>
              <div>
                <Cb on={!!dis.other_allergy} label="알레르기 (" onToggle={() => ut(["section2_health", "diseases", "other_allergy"], dis.other_allergy ? null : "")} />
                <EditInline value={dis.other_allergy ?? ""} onChange={(v) => u(["section2_health", "diseases", "other_allergy"], v)} width={150} /> ) <span style={{ fontSize: 9 }}>※ 식품·약물·접촉성 알레르기 등</span>
              </div>
              <div>
                <Cb on={!!dis.other_other} label="기타 (" onToggle={() => ut(["section2_health", "diseases", "other_other"], dis.other_other ? null : "")} />
                <EditInline value={dis.other_other ?? ""} onChange={(v) => u(["section2_health", "diseases", "other_other"], v)} width={200} /> )
              </div>
            </td>
          </tr>
          <tr>
            <th rowSpan={5} className="w-24 text-center" style={{ writingMode: undefined }}>나. 복약 및<br />의료이용</th>
            <td colSpan={5} className="skip-empty-mark">
              <Cb
                on={!(s2.medication_regular?.reason || s2.medication_regular?.hospital || s2.medication_regular?.interval || s2.medication_irregular || s2.medication_sleep || s2.medication_other)}
                label="복용하는 약이 없음"
                onToggle={() => {
                  const hasAny = s2.medication_regular?.reason || s2.medication_regular?.hospital || s2.medication_regular?.interval || s2.medication_irregular || s2.medication_sleep || s2.medication_other;
                  if (hasAny && confirm("체크된 모든 복약 정보를 해제하시겠습니까?")) {
                    u(["section2_health", "medication_regular"], { reason: "", hospital: "", interval: "" });
                    u(["section2_health", "medication_irregular"], null);
                    u(["section2_health", "medication_sleep"], false);
                    u(["section2_health", "medication_other"], "");
                  }
                }}
              />
            </td>
          </tr>
          <tr>
            <td colSpan={5}>
              <Cb on={!!s2.medication_regular?.reason} label="정기적 약 복용 (사유:" onToggle={() => ut(["section2_health", "medication_regular", "reason"], s2.medication_regular?.reason ? "" : " ")} />
              <EditInline value={s2.medication_regular?.reason} onChange={(v) => u(["section2_health", "medication_regular", "reason"], v)} width={160} />
              ,병원명: <EditInline value={s2.medication_regular?.hospital} onChange={(v) => u(["section2_health", "medication_regular", "hospital"], v)} width={120} />
              ,진료주기: <EditInline value={s2.medication_regular?.interval} onChange={(v) => u(["section2_health", "medication_regular", "interval"], v)} width={80} /> )
            </td>
          </tr>
          <tr>
            <td colSpan={5}><Cb on={!!s2.medication_irregular} label="비정기적 약 복용 (사유:" onToggle={() => ut(["section2_health", "medication_irregular"], s2.medication_irregular ? null : "")} /> <EditInline value={s2.medication_irregular ?? ""} onChange={(v) => u(["section2_health", "medication_irregular"], v)} width={200} /> )</td>
          </tr>
          <tr>
            <td colSpan={5}><Cb on={!!s2.medication_sleep} label="수면장애로 인한 약 복용" onToggle={() => ut(["section2_health", "medication_sleep"], !s2.medication_sleep)} /></td>
          </tr>
          <tr>
            <td colSpan={5}>기타 ( <EditInline value={s2.medication_other} onChange={(v) => u(["section2_health", "medication_other"], v)} width={300} /> )</td>
          </tr>
          <tr><th colSpan={6} className="nf-sub-ko" style={{ background: "#fafafa" }}>다. 구강과 영양상태</th></tr>
          <tr>
            <th className="w-24">1) 구강상태</th>
            <td colSpan={5}>
              <Cb on={s2.oral_status === "양호"} label="양호" onToggle={() => ut(["section2_health", "oral_status"], "양호")} />
              <Cb on={s2.oral_status?.startsWith("틀니")} label="틀니착용" onToggle={() => ut(["section2_health", "oral_status"], "틀니착용")} />
              <Cb on={(s2.oral_status || "").includes("부분")} label="부분" onToggle={() => ut(["section2_health", "oral_status"], "틀니착용(부분)")} />
              <Cb on={(s2.oral_status || "").includes("완전")} label="완전" onToggle={() => ut(["section2_health", "oral_status"], "틀니착용(완전)")} />
              <Cb on={s2.oral_status === "잔존치아 없음"} label="잔존치아 없음" onToggle={() => ut(["section2_health", "oral_status"], "잔존치아 없음")} />
              <Cb on={s2.oral_status?.startsWith("기타")} label="기타" onToggle={() => ut(["section2_health", "oral_status"], "기타")} />
            </td>
          </tr>
          <tr>
            <th>2) 구강건강</th>
            <td colSpan={5}>
              <Cb on={s2.oral_health === "양호"} label="양호" onToggle={() => ut(["section2_health", "oral_health"], "양호")} />
              <Cb on={s2.oral_health === "구취/위생불량"} label="구취/위생불량" onToggle={() => ut(["section2_health", "oral_health"], "구취/위생불량")} />
              <Cb on={s2.oral_health === "잇몸출혈/통증"} label="잇몸출혈/통증" onToggle={() => ut(["section2_health", "oral_health"], "잇몸출혈/통증")} />
              <Cb on={s2.oral_health === "구강건조"} label="구강건조" onToggle={() => ut(["section2_health", "oral_health"], "구강건조")} />
              <Cb on={s2.oral_health === "기타"} label="기타" onToggle={() => ut(["section2_health", "oral_health"], "기타")} />
            </td>
          </tr>
          <tr>
            <th rowSpan={3}>3) 식사형태</th>
            <td colSpan={5}>
              {["일반식", "다진식", "죽", "유동식", "경관영양", "기타"].map((x) => (
                <Cb key={x} on={s2.diet_form === x} label={x} onToggle={() => ut(["section2_health", "diet_form"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <td colSpan={5}>
              치료식 &nbsp;
              {["해당 없음", "당뇨식", "저염식", "기타"].map((x) => (
                <Cb key={x} on={s2.therapeutic_diet === x} label={x} onToggle={() => ut(["section2_health", "therapeutic_diet"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <th className="w-32">식사제공 유의사항</th>
            <td colSpan={4}><EditText value={s2.meal_notes} onChange={(v) => u(["section2_health", "meal_notes"], v)} heightMm={10} maxLen={100} /></td>
          </tr>
          <tr>
            <th>4) 영양상태</th>
            <td colSpan={5}>
              <Cb on={s2.nutrition === "양호"} label="양호" onToggle={() => ut(["section2_health", "nutrition"], "양호")} />
              <Cb on={s2.nutrition?.startsWith("불량")} label="불량" onToggle={() => ut(["section2_health", "nutrition"], "불량")} />
              &nbsp;
              {["식욕부진", "체중감소", "체중과다", "기타"].map((x) => (
                <Cb key={x} on={(s2.nutrition || "").includes(x)} label={x} onToggle={() => ut(["section2_health", "nutrition"], `불량(${x})`)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={6} className="nf-sub-ko" style={{ background: "#fafafa" }}>라. 의견 및 판단근거</th></tr>
          <tr><td colSpan={6}><EditText value={s2.opinion} onChange={(v) => u(["section2_health", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>
    </section>
  );
}

function DiseaseRow({ cat, items, path, data, t }: { cat: string; items: string[]; path: string[]; data: string[]; t: (p: string[], i: string) => void }) {
  return (
    <tr>
      <th className="w-24">{cat}</th>
      <td colSpan={5}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 28px" }}>
          {items.map((it) => (
            <Cb key={it} on={data.includes(it)} label={it} onToggle={() => t(path, it)} />
          ))}
        </div>
      </td>
    </tr>
  );
}

// ============== PAGE 2 ==============
function Page2({ d, u, ut, t }: { d: Dict; u: (p: string[], v: any) => void; ut: (p: string[], v: any) => void; t: (p: string[], i: string) => void }) {
  const s3 = d.section3_adl ?? {};
  const s4 = d.section4_physical ?? {};
  const adlLeft = [
    { key: "wash", label: "1) 세수하기" },
    { key: "brush", label: "2) 양치질하기(틀니관리)" },
  ];
  const adlRight = [
    { key: "toilet", label: "3) 화장실(이동변기) 사용하기" },
    { key: "bath", label: "4) 몸 씻기" },
  ];
  const daily = [
    [{ key: "dress", label: "1) 옷 벗고 입기" }, { key: "swallow", label: "3) 음식 삼키기" }],
    [{ key: "eat", label: "2) 식사하기" }, null],
  ];
  const iadl = [
    [{ key: "clean", label: "1) 청소 및 정리정돈" }, { key: "transport", label: "4) 교통수단 이용하기" }],
    [{ key: "cook", label: "2) 식사 준비하기" }, { key: "medication", label: "5) 약 챙겨먹기" }],
    [{ key: "laundry", label: "3) 빨래하기" }, { key: "shopping", label: "6) 물건사기" }],
  ];
  const phys = [
    [{ key: "turn", label: "1) 누운상태에서 옆으로 돌아눕기" }, { key: "stand", label: "3) 바닥에 앉은 상태에서 일어서기" }],
    [{ key: "sit_up", label: "2) 누운상태에서 몸 일으켜 앉기" }, { key: "walk", label: "4) 실내 보행하기" }],
  ];

  const SC = (p: string, key: string) => {
    const cur = ((d as any)[p] ?? {})[key] ?? 0;
    return (
      <>
        <ScoreCell value={0} current={cur} onChange={(v) => u([p, key], v)} />
        <ScoreCell value={1} current={cur} onChange={(v) => u([p, key], v)} />
        <ScoreCell value={2} current={cur} onChange={(v) => u([p, key], v)} />
        <ScoreCell value={3} current={cur} onChange={(v) => u([p, key], v)} />
      </>
    );
  };

  return (
    <section className="nf-page">
      <div className="nf-page-num">2 / 5</div>
      <div className="nf-section-bar">3. 일상생활기능</div>
      <p className="nf-notice" style={{ textAlign: "right" }}>※도움이 필요한 정도를 평가하여 해당 숫자에 ∨ 표기를 합니다.<br />(0)혼자 할 수 있음, (1) 지시(준비)도움, (2) 직접(부축)도움, (3) 전혀 수행할 수 없음</p>
      <table className="nf-table">
        <thead>
          <tr>
            <th rowSpan={2} className="w-24 text-center">구분</th>
            <th rowSpan={2} className="text-center">구분</th>
            <th colSpan={4} className="text-center">확인</th>
            <th rowSpan={2} className="text-center">구분</th>
            <th colSpan={4} className="text-center">확인</th>
          </tr>
          <tr>
            <th className="w-7 text-center">0</th><th className="w-7 text-center">1</th><th className="w-7 text-center">2</th><th className="w-7 text-center">3</th>
            <th className="w-7 text-center">0</th><th className="w-7 text-center">1</th><th className="w-7 text-center">2</th><th className="w-7 text-center">3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th rowSpan={2} className="text-center">가. 위생관리</th>
            <td>{adlLeft[0].label}</td>{SC("section3_adl", adlLeft[0].key)}
            <td>{adlRight[0].label}</td>{SC("section3_adl", adlRight[0].key)}
          </tr>
          <tr>
            <td>{adlLeft[1].label}</td>{SC("section3_adl", adlLeft[1].key)}
            <td>{adlRight[1].label}</td>{SC("section3_adl", adlRight[1].key)}
          </tr>
          {daily.map((row, i) => (
            <tr key={i}>
              {i === 0 && <th rowSpan={2} className="text-center">나. 일상생활</th>}
              <td>{row[0]?.label}</td>{row[0] ? SC("section3_adl", row[0].key) : <td colSpan={4} />}
              <td>{row[1]?.label}</td>{row[1] ? SC("section3_adl", row[1].key) : <td colSpan={4} />}
            </tr>
          ))}
          {iadl.map((row, i) => (
            <tr key={i}>
              {i === 0 && <th rowSpan={3} className="text-center">다. 도구적<br />일상생활</th>}
              <td>{row[0]?.label}</td>{row[0] ? SC("section3_adl", row[0].key) : <td colSpan={4} />}
              <td>{row[1]?.label}</td>{row[1] ? SC("section3_adl", row[1].key) : <td colSpan={4} />}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="nf-table mt-2">
        <tbody>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>라. 배뇨기능 및 방법</th></tr>
          <tr>
            <th className="w-24">1) 배뇨기능</th>
            <td>
              {["양호", "요실금", "배뇨곤란(배뇨 시 통증, 배뇨지연 등)", "요의 느끼지 못함", "기타"].map((x) => (
                <Cb key={x} on={s3.urination_function === x} label={x} onToggle={() => ut(["section3_adl", "urination_function"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <th>2) 배뇨방법</th>
            <td>
              {["화장실", "이동변기", "기저귀", "배뇨관(유치도뇨관·방광루 등)", "기타"].map((x) => (
                <Cb key={x} on={s3.urination_method === x} label={x} onToggle={() => ut(["section3_adl", "urination_method"], x)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>마. 배변기능 및 방법</th></tr>
          <tr>
            <th>1) 배변기능</th>
            <td>
              {["양호", "변실금", "잦은 설사", "변비", "변의 느끼지 못함", "기타"].map((x) => (
                <Cb key={x} on={s3.defecation_function === x} label={x} onToggle={() => ut(["section3_adl", "defecation_function"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <th>2) 배변방법</th>
            <td>
              {["화장실", "이동변기", "기저귀", "장루", "기타"].map((x) => (
                <Cb key={x} on={s3.defecation_method === x} label={x} onToggle={() => ut(["section3_adl", "defecation_method"], x)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>바. 의견 및 판단근거</th></tr>
          <tr><td colSpan={2}><EditText value={s3.opinion} onChange={(v) => u(["section3_adl", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>

      <div className="nf-section-bar">4. 재활 및 신체기능</div>
      <table className="nf-table">
        <tbody>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>가. 근골격계 증상</th></tr>
          {[
            ["joint_contracture", "1) 관절구축"],
            ["motor_disorder", "2) 운동장애"],
            ["paralysis", "3) 마비"],
            ["amputation", "4) 절단"],
          ].map(([k, l]) => (
            <tr key={k}>
              <th className="w-24">{l}</th>
              <td>
                <Cb on={s4[k] === "없음"} label="없음" onToggle={() => ut(["section4_physical", k], "없음")} />
                <Cb on={s4[k]?.includes("상지")} label="상지(" onToggle={() => ut(["section4_physical", k], "상지")} />
                <Cb on={s4[`${k}_arm_left`]} label="좌" onToggle={() => ut(["section4_physical", `${k}_arm_left`], !s4[`${k}_arm_left`])} />
                <Cb on={s4[`${k}_arm_right`]} label="우" onToggle={() => ut(["section4_physical", `${k}_arm_right`], !s4[`${k}_arm_right`])} />)
                &nbsp;<Cb on={s4[k]?.includes("하지")} label="하지(" onToggle={() => ut(["section4_physical", k], "하지")} />
                <Cb on={s4[`${k}_leg_left`]} label="좌" onToggle={() => ut(["section4_physical", `${k}_leg_left`], !s4[`${k}_leg_left`])} />
                <Cb on={s4[`${k}_leg_right`]} label="우" onToggle={() => ut(["section4_physical", `${k}_leg_right`], !s4[`${k}_leg_right`])} />)
                &nbsp;부위( <EditInline value={s4[`${k}_site`]} onChange={(v) => u(["section4_physical", `${k}_site`], v)} width={120} /> )
              </td>
            </tr>
          ))}
          <tr><th className="w-24">나. 보행상태</th>
            <td>
              {["자립보행 가능", "보장구를 사용하여 자립보행 가능", "부축해주면 보행 가능", "보장구를 사용하여 부축을 받아 보행 가능", "보행 불가"].map((x) => (
                <div key={x}><Cb on={s4.gait === x} label={x} onToggle={() => ut(["section4_physical", "gait"], x)} /></div>
              ))}
              <div className="mt-1">보장구 종류 &nbsp;
                {["지팡이", "성인용 보행기", "휠체어", "기타"].map((x) => (
                  <Cb key={x} on={(s4.aids ?? []).includes(x)} label={x} onToggle={() => t(["section4_physical", "aids"], x)} />
                ))}
              </div>
            </td>
          </tr>
          <tr>
            <th>다. 지난 3개월<br />간 낙상</th>
            <td>
              <Cb on={!s4.falls_3mo} label="없음" onToggle={() => ut(["section4_physical", "falls_3mo"], 0)} />
              <Cb on={(s4.falls_3mo ?? 0) > 0} label="있음" onToggle={() => ut(["section4_physical", "falls_3mo"], s4.falls_3mo ? 0 : 1)} />
              (횟수: <EditInline value={s4.falls_3mo} onChange={(v) => u(["section4_physical", "falls_3mo"], Number(v) || 0)} width={40} /> )
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>라. 신체기능 &nbsp;&nbsp;<span style={{ fontWeight: 400, fontSize: 9 }}>※ (0)혼자 할 수 있음, (1)지시(준비)도움, (2)직접(부축)도움, (3)전혀 수행할 수 없음</span></th></tr>
          <tr>
            <td colSpan={2} style={{ padding: 0 }}>
              <table className="nf-table" style={{ borderTop: 0 }}>
                <thead>
                  <tr>
                    <th className="text-center">구분</th>
                    <th className="w-7 text-center">0</th><th className="w-7 text-center">1</th><th className="w-7 text-center">2</th><th className="w-7 text-center">3</th>
                    <th className="text-center">구분</th>
                    <th className="w-7 text-center">0</th><th className="w-7 text-center">1</th><th className="w-7 text-center">2</th><th className="w-7 text-center">3</th>
                  </tr>
                </thead>
                <tbody>
                  {phys.map((row, i) => (
                    <tr key={i}>
                      <td>{row[0].label}</td>{SC("section4_physical", row[0].key)}
                      <td>{row[1].label}</td>{SC("section4_physical", row[1].key)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>마. 의견 및 판단근거</th></tr>
          <tr><td colSpan={2}><EditText value={s4.opinion} onChange={(v) => u(["section4_physical", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ============== PAGE 3 ==============
function Page3({ d, u, ut, t }: { d: Dict; u: (p: string[], v: any) => void; ut: (p: string[], v: any) => void; t: (p: string[], i: string) => void }) {
  const s5 = d.section5_nursing ?? {};
  const s6 = d.section6_cognition ?? {};

  return (
    <section className="nf-page">
      <div className="nf-page-num">3 / 5</div>
      <div className="nf-section-bar">5. 간호관리</div>
      <table className="nf-table">
        <tbody>
          <NursingRow label="가. 호흡기간호" val={s5.respiratory} items={["없음", "기관절개관", "흡인", "산소요법", "분무요법(네뷸라이저)", "기타"]} onChange={(v) => u(["section5_nursing", "respiratory"], v)} />
          <tr>
            <th className="w-24">나. 피부간호</th>
            <td>
              <Cb on={s5.skin === "없음"} label="없음" onToggle={() => ut(["section5_nursing", "skin"], "없음")} />
              <Cb on={s5.skin?.startsWith("욕창")} label="욕창" onToggle={() => ut(["section5_nursing", "skin"], "욕창")} />
              (부위: <EditInline value={s5.skin_site} onChange={(v) => u(["section5_nursing", "skin_site"], v)} width={80} />,
              {["1단계", "2단계", "3단계", "4단계"].map((x) => (
                <Cb key={x} on={s5.skin_stage === x} label={x} onToggle={() => ut(["section5_nursing", "skin_stage"], x)} />
              ))})
              <Cb on={s5.skin === "말초신경병증궤양"} label="말초신경병증궤양(당뇨발 등)" onToggle={() => ut(["section5_nursing", "skin"], "말초신경병증궤양")} />
              <Cb on={s5.skin === "화상"} label="화상" onToggle={() => ut(["section5_nursing", "skin"], "화상")} />
              <Cb on={s5.skin === "소양증"} label="소양증" onToggle={() => ut(["section5_nursing", "skin"], "소양증")} />
              <Cb on={s5.skin === "기타"} label="기타" onToggle={() => ut(["section5_nursing", "skin"], "기타")} />
            </td>
          </tr>
          <NursingRow label="다. 소화기간호" val={s5.digestive} items={["없음", "비위관", "위관", "기타"]} onChange={(v) => u(["section5_nursing", "digestive"], v)} />
          <tr>
            <th>라. 통증간호</th>
            <td>
              <div><Cb on={s5.pain_type === "없음"} label="없음" onToggle={() => ut(["section5_nursing", "pain_type"], "없음")} /></div>
              <div><Cb on={s5.pain_type === "일반통증"} label="일반통증(부위:" onToggle={() => ut(["section5_nursing", "pain_type"], "일반통증")} /> <EditInline value={s5.pain_site} onChange={(v) => u(["section5_nursing", "pain_site"], v)} width={80} /> , 정도: <EditInline value={s5.pain_score} onChange={(v) => u(["section5_nursing", "pain_score"], Number(v) || 0)} width={40} /> 점)</div>
              <div><Cb on={s5.pain_type === "암성통증"} label="암성통증(부위:" onToggle={() => ut(["section5_nursing", "pain_type"], "암성통증")} /> <EditInline value={s5.pain_cancer_site} onChange={(v) => u(["section5_nursing", "pain_cancer_site"], v)} width={80} /> , 정도: <EditInline value={s5.pain_cancer_score} onChange={(v) => u(["section5_nursing", "pain_cancer_score"], v)} width={40} /> 점)</div>
              <div>통증빈도 &nbsp;
                <Cb on={s5.pain_freq === "일1회 이상"} label="일1회 이상" onToggle={() => ut(["section5_nursing", "pain_freq"], "일1회 이상")} />
                <Cb on={s5.pain_freq === "주 1회 이상"} label="주 1회 이상" onToggle={() => ut(["section5_nursing", "pain_freq"], "주 1회 이상")} />
              </div>
              <div>통증관리 &nbsp;
                {["일반진통제", "마약성 경구 진통제", "마약성 주사제", "마약성 진통제 패치", "냉·온 요법", "기타"].map((x) => (
                  <Cb key={x} on={s5.pain_manage === x} label={x} onToggle={() => ut(["section5_nursing", "pain_manage"], x)} />
                ))}
              </div>
            </td>
          </tr>
          <NursingRow label="마. 배뇨간호" val={s5.urination_care} items={["없음", "유치도뇨관", "단순도뇨", "요루", "방광루", "투석(혈액)", "투석(복막)", "기타"]} onChange={(v) => u(["section5_nursing", "urination_care"], v)} />
          <NursingRow label="바. 배변간호" val={s5.defecation_care} items={["없음", "장루", "관장", "기타"]} onChange={(v) => u(["section5_nursing", "defecation_care"], v)} />
          <NursingRow label="사. 내분비간호" val={s5.endocrine} items={["없음", "인슐린투여", "기타"]} onChange={(v) => u(["section5_nursing", "endocrine"], v)} />
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>아. 의견 및 판단근거</th></tr>
          <tr><td colSpan={2}><EditText value={s5.opinion} onChange={(v) => u(["section5_nursing", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>

      <div className="nf-section-bar">6. 인지 및 의사소통 &nbsp; <span style={{ fontWeight: 400, fontSize: 9 }}>※ 해당되는 증상에 모두 ∨표기</span></div>
      <table className="nf-table">
        <tbody>
          <tr>
            <th className="w-24">가. 인지기능</th>
            <td>
              <div><Cb on={(s6.cognitive ?? []).includes("양호")} label="양호" onToggle={() => t(["section6_cognition", "cognitive"], "양호")} /></div>
              <div>
                <Cb on={(s6.cognitive ?? []).includes("기억력 저하")} label="기억력 저하(" onToggle={() => t(["section6_cognition", "cognitive"], "기억력 저하")} />
                <Cb on={(s6.cognitive ?? []).includes("단기")} label="단기" onToggle={() => t(["section6_cognition", "cognitive"], "단기")} />
                <Cb on={(s6.cognitive ?? []).includes("장기")} label="장기" onToggle={() => t(["section6_cognition", "cognitive"], "장기")} />)
              </div>
              <div>
                <Cb on={(s6.cognitive ?? []).includes("지남력 저하")} label="지남력 저하(" onToggle={() => t(["section6_cognition", "cognitive"], "지남력 저하")} />
                <Cb on={(s6.cognitive ?? []).includes("시간")} label="시간" onToggle={() => t(["section6_cognition", "cognitive"], "시간")} />
                <Cb on={(s6.cognitive ?? []).includes("장소")} label="장소" onToggle={() => t(["section6_cognition", "cognitive"], "장소")} />
                <Cb on={(s6.cognitive ?? []).includes("사람")} label="사람" onToggle={() => t(["section6_cognition", "cognitive"], "사람")} />)
              </div>
              <div>
                <Cb on={(s6.cognitive ?? []).includes("판단력 저하")} label="판단력 저하" onToggle={() => t(["section6_cognition", "cognitive"], "판단력 저하")} />
                <Cb on={(s6.cognitive ?? []).includes("이해력 저하")} label="이해력 저하" onToggle={() => t(["section6_cognition", "cognitive"], "이해력 저하")} />
                <Cb on={(s6.cognitive ?? []).includes("주의력 저하")} label="주의력 저하" onToggle={() => t(["section6_cognition", "cognitive"], "주의력 저하")} />
              </div>
            </td>
          </tr>
          <tr>
            <th>나. 행동증상</th>
            <td>
              <Cb on={(s6.behavior ?? []).includes("없음")} label="없음" onToggle={() => t(["section6_cognition", "behavior"], "없음")} />
              <div>
                {["망상", "환각(환청·환시 등)", "길 잃음", "도움에 저항", "불규칙 수면", "배회", "공격성", "부적절한 행동", "불결행동", "식습관 변화(식사거부, 과다 등)", "부적절한 옷 입기", "반복적인 말이나 행동"].map((x) => (
                  <Cb key={x} on={(s6.behavior ?? []).includes(x)} label={x} onToggle={() => t(["section6_cognition", "behavior"], x)} />
                ))}
              </div>
            </td>
          </tr>
          <tr>
            <th>다. 심리증상</th>
            <td>
              <Cb on={(s6.psychological ?? []).includes("없음")} label="없음" onToggle={() => t(["section6_cognition", "psychological"], "없음")} />
              {["우울감", "무기력·무감동", "불안·초조", "기타"].map((x) => (
                <Cb key={x} on={(s6.psychological ?? []).includes(x)} label={x} onToggle={() => t(["section6_cognition", "psychological"], x)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>라. 의사소통</th></tr>
          <ScaleRow label="1) 이해능력" options={["양호", "약간 어려움", "단순 소통만 가능", "이해하지 못함", "측정불가"]} value={s6.comm_understand} onChange={(v) => u(["section6_cognition", "comm_understand"], v)} />
          <ScaleRow label="2) 표현능력" options={["양호", "약간 어려움", "단순 표현만 가능", "표현하지 못함", "측정불가"]} value={s6.comm_express} onChange={(v) => u(["section6_cognition", "comm_express"], v)} />
          <ScaleRow label="3) 시력상태" sub="안경사용" subOn={!!s6.glasses} onSubToggle={() => u(["section6_cognition", "glasses"], !s6.glasses)} options={["정상", "1미터 거리 보임", "근접한 사물 보임", "보이지 않음", "판단불능"]} value={s6.comm_vision} onChange={(v) => u(["section6_cognition", "comm_vision"], v)} />
          <ScaleRow label="4) 청력상태" sub="보청기 사용" subOn={!!s6.hearing_aid} onSubToggle={() => u(["section6_cognition", "hearing_aid"], !s6.hearing_aid)} options={["정상", "먼 곳의 소리는 들리지 않음", "큰 소리만 들림", "들리지 않음", "판단불능"]} value={s6.comm_hearing} onChange={(v) => u(["section6_cognition", "comm_hearing"], v)} />
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>마. 의견 및 판단근거</th></tr>
          <tr><td colSpan={2}><EditText value={s6.opinion} onChange={(v) => u(["section6_cognition", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>
    </section>
  );
}

function NursingRow({ label, val, items, onChange }: { label: string; val: any; items: string[]; onChange: (v: string) => void }) {
  return (
    <tr>
      <th className="w-24">{label}</th>
      <td>
        {items.map((x) => (
          <Cb key={x} on={val === x} label={x} onToggle={() => onChange(x)} />
        ))}
      </td>
    </tr>
  );
}

function ScaleRow({ label, options, value, onChange, sub, subOn, onSubToggle }: { label: string; options: string[]; value: any; onChange: (v: string) => void; sub?: string; subOn?: boolean; onSubToggle?: () => void }) {
  return (
    <tr>
      <th className="w-24">{label}{sub && <div style={{ fontWeight: 400, fontSize: 9 }}><Cb on={!!subOn} label={sub} onToggle={onSubToggle} /></div>}</th>
      <td>
        {options.map((x) => (
          <Cb key={x} on={value === x} label={x} onToggle={() => onChange(x)} />
        ))}
      </td>
    </tr>
  );
}

// ============== PAGE 4 ==============
function Page4({ d, u, ut, t }: { d: Dict; u: (p: string[], v: any) => void; ut: (p: string[], v: any) => void; t: (p: string[], i: string) => void }) {
  const s7 = d.section7_support ?? {};
  const s8 = d.section8_environment ?? {};

  const envRows: Array<[string, string, boolean, string, string, boolean]> = [
    ["1) 엘리베이터", "elevator", !!s8.elevator, "7) 주방 상태", "kitchen", s8.kitchen === "양호"],
    ["2) 실내·외 계단", "stairs", !!s8.stairs, "8) 화장실 위치", "toilet_location", s8.toilet_location === "실내"],
    ["3) 실내 장애물(문턱)", "thresholds", !!s8.thresholds, "9) 좌변기", "toilet_seat", !!s8.toilet_seat],
    ["4) 바닥·벽지", "floor_wall", s8.floor_wall === "양호", "10) 온수", "hot_water", !!s8.hot_water],
    ["5) 냉·난방 및 환기", "hvac", s8.hvac === "양호", "11) 샤워기", "shower", !!s8.shower],
    ["6) 조명", "lighting", s8.lighting === "양호", "12) 세면대", "sink", !!s8.sink],
  ];

  return (
    <section className="nf-page">
      <div className="nf-page-num">4 / 5</div>
      <div className="nf-section-bar">7. 수급자의 가족 및 지지체계</div>
      <table className="nf-table">
        <tbody>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>가. 주거상태</th></tr>
          <tr>
            <th className="w-24">1) 수급자의<br />주거형태</th>
            <td>
              {["자택", "노인요양시설(노인요양공동생활가정 포함)", "양로시설", "요양병원", "기타"].map((x) => (
                <Cb key={x} on={s7.residence === x} label={x} onToggle={() => ut(["section7_support", "residence"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <th>2) 동거인</th>
            <td>
              {["독거", "배우자", "자녀", "며느리·사위", "형제·자매", "손자녀", "부모", "친척", "기타"].map((x) => (
                <Cb key={x} on={(s7.cohabitant ?? []).includes(x)} label={x} onToggle={() => t(["section7_support", "cohabitant"], x)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>나. 수급자의 지지체계</th></tr>
          <tr>
            <th>1) 자녀</th>
            <td>
              <Cb on={!s7.children_son && !s7.children_daughter} label="없음" onToggle={() => { u(["section7_support", "children_son"], 0); u(["section7_support", "children_daughter"], 0); }} />
              <Cb on={!!(s7.children_son || s7.children_daughter)} label="있음" onToggle={() => {}} />
              (아들 <EditInline value={s7.children_son} onChange={(v) => u(["section7_support", "children_son"], Number(v) || 0)} width={30} /> 명,
              딸 <EditInline value={s7.children_daughter} onChange={(v) => u(["section7_support", "children_daughter"], Number(v) || 0)} width={30} /> 명)
            </td>
          </tr>
          <tr>
            <th rowSpan={2}>2) 주 수발자</th>
            <td>
              <div>
                <Cb on={s7.primary_caregiver_present === false} label="없음" onToggle={() => ut(["section7_support", "primary_caregiver_present"], false)} />
                <Cb on={!!s7.primary_caregiver_present} label="있음" onToggle={() => ut(["section7_support", "primary_caregiver_present"], true)} />
              </div>
              <div>가) 주 수발자의 관계 &nbsp;
                {["배우자", "자녀", "며느리·사위", "형제·자매", "손자녀", "부모", "친척", "기타"].map((x) => (
                  <Cb key={x} on={s7.primary_caregiver_relation === x} label={x} onToggle={() => ut(["section7_support", "primary_caregiver_relation"], x)} />
                ))}
              </div>
            </td>
          </tr>
          <tr>
            <td>나) 주 수발자의 부양부담 &nbsp;
              {["전혀 부담되지 않음", "아주 가끔 부담됨", "가끔 부담됨", "자주부담됨", "항상 부담됨"].map((x) => (
                <Cb key={x} on={s7.primary_caregiver_burden === x} label={x} onToggle={() => ut(["section7_support", "primary_caregiver_burden"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <th rowSpan={3}>3) 수급자의<br />사회적교류</th>
            <td>하루종일 혼자있음 &nbsp;
              <Cb on={s7.alone_all_day === true} label="예" onToggle={() => ut(["section7_support", "alone_all_day"], true)} />
              <Cb on={s7.alone_all_day === false} label="아니오" onToggle={() => ut(["section7_support", "alone_all_day"], false)} />
            </td>
          </tr>
          <tr>
            <td>가족 교류 &nbsp;
              {["주1~2회", "월1~2회", "분기1~2회", "연1~2회", "없음"].map((x) => (
                <Cb key={x} on={s7.social_family === x} label={x} onToggle={() => ut(["section7_support", "social_family"], x)} />
              ))}
            </td>
          </tr>
          <tr>
            <td>친구·이웃 교류 &nbsp;
              {["주1~2회", "월1~2회", "분기1~2회", "연1~2회", "없음"].map((x) => (
                <Cb key={x} on={s7.social_friends === x} label={x} onToggle={() => ut(["section7_support", "social_friends"], x)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>다. 현재 이용 중인 지역사회 자원</th></tr>
          <tr>
            <td colSpan={2}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <div><Cb on={(s7.community ?? []).includes("없음")} label="없음" onToggle={() => t(["section7_support", "community"], "없음")} /></div>
                <div></div>
                <div><Cb on={(s7.community ?? []).includes("노인맞춤돌봄서비스")} label="노인맞춤돌봄서비스(서비스 내용: )" onToggle={() => t(["section7_support", "community"], "노인맞춤돌봄서비스")} /></div>
                <div></div>
                <div><Cb on={(s7.community ?? []).includes("노인복지관")} label="노인복지관" onToggle={() => t(["section7_support", "community"], "노인복지관")} /></div>
                <div><Cb on={(s7.community ?? []).includes("보건의료서비스(보건소, 치매안심센터 등)")} label="보건의료서비스(보건소, 치매안심센터 등)" onToggle={() => t(["section7_support", "community"], "보건의료서비스(보건소, 치매안심센터 등)")} /></div>
                <div><Cb on={(s7.community ?? []).includes("식사지원(급식 및 도시락 배달 등)")} label="식사지원(급식 및 도시락 배달 등)" onToggle={() => t(["section7_support", "community"], "식사지원(급식 및 도시락 배달 등)")} /></div>
                <div><Cb on={(s7.community ?? []).includes("이동지원 서비스(차량지원, 무료택시 등)")} label="이동지원 서비스(차량지원, 무료택시 등)" onToggle={() => t(["section7_support", "community"], "이동지원 서비스(차량지원, 무료택시 등)")} /></div>
                <div><Cb on={(s7.community ?? []).includes("주거지원서비스(도배, 장판, 주택개조 등)")} label="주거지원서비스(도배, 장판, 주택개조 등)" onToggle={() => t(["section7_support", "community"], "주거지원서비스(도배, 장판, 주택개조 등)")} /></div>
                <div><Cb on={(s7.community ?? []).includes("이미용서비스")} label="이미용서비스" onToggle={() => t(["section7_support", "community"], "이미용서비스")} /></div>
                <div><Cb on={(s7.community ?? []).includes("장애인활동지원서비스")} label="장애인활동지원서비스" onToggle={() => t(["section7_support", "community"], "장애인활동지원서비스")} /></div>
                <div><Cb on={(s7.community ?? []).includes("종교단체 지원")} label="종교단체 지원" onToggle={() => t(["section7_support", "community"], "종교단체 지원")} /></div>
                <div><Cb on={(s7.community ?? []).includes("기타")} label="기타 ( )" onToggle={() => t(["section7_support", "community"], "기타")} /></div>
                <div></div>
              </div>
            </td>
          </tr>
          <tr><th colSpan={2} className="nf-sub-ko" style={{ background: "#fafafa" }}>라. 의견 및 판단근거</th></tr>
          <tr><td colSpan={2}><EditText value={s7.opinion} onChange={(v) => u(["section7_support", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>

      <div className="nf-section-bar">8. 수급자가 거주하는 곳의 환경 &nbsp; <span style={{ fontWeight: 400, fontSize: 9 }}>※ 시설급여기관은 해당하지 않습니다.</span></div>
      <table className="nf-table">
        <tbody>
          <tr>
            <th className="w-32">가. 수급자가 거주하는 곳의 층수</th>
            <td colSpan={3}>
              {["지층", "1층", "2층", "3층 이상"].map((x) => (
                <Cb key={x} on={s8.floor === x} label={x} onToggle={() => ut(["section8_environment", "floor"], x)} />
              ))}
            </td>
          </tr>
          <tr><th colSpan={4} className="nf-sub-ko" style={{ background: "#fafafa" }}>나. 생활환경</th></tr>
          <tr>
            <th className="text-center">주거환경</th><th className="text-center">상태</th>
            <th className="text-center">주거환경</th><th className="text-center">상태</th>
          </tr>
          {envRows.map((row, i) => (
            <tr key={i}>
              <td>{row[0]}</td>
              <td>
                <Cb on={row[2]} label="있음/양호" onToggle={() => {
                  if (row[1] === "floor_wall" || row[1] === "hvac" || row[1] === "lighting" || row[1] === "kitchen") u(["section8_environment", row[1]], "양호");
                  else if (row[1] === "toilet_location") u(["section8_environment", "toilet_location"], "실내");
                  else u(["section8_environment", row[1]], true);
                }} />
                <Cb on={!row[2]} label="없음/불량" onToggle={() => {
                  if (row[1] === "floor_wall" || row[1] === "hvac" || row[1] === "lighting" || row[1] === "kitchen") u(["section8_environment", row[1]], "불량");
                  else if (row[1] === "toilet_location") u(["section8_environment", "toilet_location"], "실외");
                  else u(["section8_environment", row[1]], false);
                }} />
              </td>
              <td>{row[3]}</td>
              <td>
                <Cb on={row[5]} label="있음/양호" onToggle={() => {
                  if (row[4] === "kitchen" || row[4] === "floor_wall" || row[4] === "hvac" || row[4] === "lighting") u(["section8_environment", row[4]], "양호");
                  else if (row[4] === "toilet_location") u(["section8_environment", "toilet_location"], "실내");
                  else u(["section8_environment", row[4]], true);
                }} />
                <Cb on={!row[5]} label="없음/불량" onToggle={() => {
                  if (row[4] === "kitchen" || row[4] === "floor_wall" || row[4] === "hvac" || row[4] === "lighting") u(["section8_environment", row[4]], "불량");
                  else if (row[4] === "toilet_location") u(["section8_environment", "toilet_location"], "실외");
                  else u(["section8_environment", row[4]], false);
                }} />
              </td>
            </tr>
          ))}
          <tr><th colSpan={4} className="nf-sub-ko" style={{ background: "#fafafa" }}>다. 의견 및 판단근거</th></tr>
          <tr><td colSpan={4}><EditText value={s8.opinion} onChange={(v) => u(["section8_environment", "opinion"], v)} heightMm={16} maxLen={150} /></td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ============== PAGE 5 ==============
function Page5({ d, u, ut, t }: { d: Dict; u: (p: string[], v: any) => void; ut: (p: string[], v: any) => void; t: (p: string[], i: string) => void }) {
  const s9 = d.section9_desired ?? {};
  const s10 = d.section10_summary ?? {};

  const has = (arr: any, x: string) => Array.isArray(arr) && arr.includes(x);
  const phy = s9.physical ?? [];
  const dly = s9.daily ?? [];

  return (
    <section className="nf-page">
      <div className="nf-page-num">5 / 5</div>
      <div className="nf-section-bar">9. 수급자 및 보호자가 희망하는 서비스</div>
      <div className="nf-free">
        <div className="nf-group">
          <div className="nf-sub-label">가. 신체활동지원</div>
          <div className="nf-row">
            <Cb
              on={["세면", "구강청결", "몸단장", "머리감기", "옷갈아입기"].some((x) => has(phy, `개인위생 ${x}`))}
              label="개인위생("
              onToggle={() => {
                const subs = ["세면", "구강청결", "몸단장", "머리감기", "옷갈아입기"];
                const anyOn = subs.some((x) => has(phy, `개인위생 ${x}`));
                const next = structuredClone(d);
                const arr: string[] = Array.isArray(next.section9_desired?.physical) ? [...next.section9_desired.physical] : [];
                if (anyOn) {
                  next.section9_desired.physical = arr.filter((v: string) => !v.startsWith("개인위생"));
                } else {
                  subs.forEach((x) => { if (!arr.includes(`개인위생 ${x}`)) arr.push(`개인위생 ${x}`); });
                  next.section9_desired.physical = arr;
                }
                u(["section9_desired", "physical"], next.section9_desired.physical);
              }}
            />
            {["세면", "구강청결", "몸단장", "머리감기", "옷갈아입기"].map((x) => (
              <Cb key={x} on={has(phy, `개인위생 ${x}`)} label={x} onToggle={() => t(["section9_desired", "physical"], `개인위생 ${x}`)} />
            ))}
            도움)
          </div>
          <div className="nf-row">
            <Cb on={has(phy, "몸 씻기(목욕)")} label="몸 씻기(목욕)" onToggle={() => t(["section9_desired", "physical"], "몸 씻기(목욕)")} />
            <Cb on={has(phy, "체위변경하기")} label="체위변경하기" onToggle={() => t(["section9_desired", "physical"], "체위변경하기")} />
            <Cb on={has(phy, "식사하기(식사도움)")} label="식사하기(식사도움)" onToggle={() => t(["section9_desired", "physical"], "식사하기(식사도움)")} />
          </div>
          <div className="nf-row">
            <Cb on={has(phy, "이동도움(부축, 휠체어 등)")} label="이동도움(부축, 휠체어 등)" onToggle={() => t(["section9_desired", "physical"], "이동도움(부축, 휠체어 등)")} />
            <Cb on={has(phy, "화장실 이용하기(이동변기, 기저귀 교환 등)")} label="화장실 이용하기(이동변기, 기저귀 교환 등)" onToggle={() => t(["section9_desired", "physical"], "화장실 이용하기(이동변기, 기저귀 교환 등)")} />
          </div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">나. 일상생활 지원</div>
        <div className="nf-row">
          <Cb on={has(dly, "식사 준비 및 정리")} label="식사 준비 및 정리" onToggle={() => t(["section9_desired", "daily"], "식사 준비 및 정리")} />
          <Cb on={has(dly, "청소·주변정돈")} label="청소·주변정돈" onToggle={() => t(["section9_desired", "daily"], "청소·주변정돈")} />
          <Cb on={has(dly, "의복 세탁 및 관리")} label="의복 세탁 및 관리" onToggle={() => t(["section9_desired", "daily"], "의복 세탁 및 관리")} />
          <Cb on={has(dly, "장보기")} label="장보기" onToggle={() => t(["section9_desired", "daily"], "장보기")} />
        </div>
        <div className="nf-row">
          <Cb on={has(dly, "복약도움")} label="복약도움" onToggle={() => t(["section9_desired", "daily"], "복약도움")} />
          <Cb
            on={["병원", "관공서", "산책", "기타"].some((x) => has(dly, `외출 동행 ${x}`))}
            label="외출 동행("
            onToggle={() => {
              const subs = ["병원", "관공서", "산책", "기타"];
              const anyOn = subs.some((x) => has(dly, `외출 동행 ${x}`));
              const next = structuredClone(d);
              const arr: string[] = Array.isArray(next.section9_desired?.daily) ? [...next.section9_desired.daily] : [];
              if (anyOn) {
                next.section9_desired.daily = arr.filter((v: string) => !v.startsWith("외출 동행"));
              } else {
                subs.forEach((x) => { if (!arr.includes(`외출 동행 ${x}`)) arr.push(`외출 동행 ${x}`); });
                next.section9_desired.daily = arr;
              }
              u(["section9_desired", "daily"], next.section9_desired.daily);
            }}
          />
          {["병원", "관공서", "산책", "기타"].map((x) => (
            <Cb key={x} on={has(dly, `외출 동행 ${x}`)} label={x} onToggle={() => t(["section9_desired", "daily"], `외출 동행 ${x}`)} />
          ))})
        </div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">다. 기능회복훈련</div>
        <div className="nf-row">
          {["신체기능 훈련", "일상생활 동작 훈련"].map((x) => (
            <Cb key={x} on={has(s9.rehab, x)} label={x} onToggle={() => t(["section9_desired", "rehab"], x)} />
          ))}
        </div>
        <div className="nf-row">
          {["인지기능 향상 훈련", "여가·정서프로그램"].map((x) => (
            <Cb key={x} on={has(s9.rehab, x)} label={x} onToggle={() => t(["section9_desired", "rehab"], x)} />
          ))}
        </div>
        <div className="nf-row">
          {["물리치료", "작업치료"].map((x) => (
            <Cb key={x} on={has(s9.rehab, x)} label={x} onToggle={() => t(["section9_desired", "rehab"], x)} />
          ))}
        </div>
        <div className="nf-row">
          <Cb on={has(s9.rehab, "기타")} label="기타(" onToggle={() => t(["section9_desired", "rehab"], "기타")} /> )
        </div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">라. 인지관리 및 정서지원</div>
        <div className="nf-row">
          <Cb on={has(s9.cognition, "인지관리지원")} label="인지관리지원" onToggle={() => t(["section9_desired", "cognition"], "인지관리지원")} />
          <Cb on={has(s9.cognition, "정서지원")} label="정서지원" onToggle={() => t(["section9_desired", "cognition"], "정서지원")} />
        </div>
        <div className="nf-row"><Cb on={has(s9.cognition, "기타")} label="기타(" onToggle={() => t(["section9_desired", "cognition"], "기타")} /> )</div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">마. 건강 및 간호관리</div>
        <div className="nf-row">
          <Cb on={has(s9.health, "건강관리(투약관리 및 기초건강관리 등)")} label="건강관리(투약관리 및 기초건강관리 등)" onToggle={() => t(["section9_desired", "health"], "건강관리(투약관리 및 기초건강관리 등)")} />
          <Cb on={has(s9.health, "간호관리(욕창, 통증, 호흡기, 구강간호 등)")} label="간호관리(욕창, 통증, 호흡기, 구강간호 등)" onToggle={() => t(["section9_desired", "health"], "간호관리(욕창, 통증, 호흡기, 구강간호 등)")} />
        </div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">바. 방문목욕</div>
        <div className="nf-row">
          <Cb on={has(s9.bath, "차량을 이용한 방문목욕")} label="차량을 이용한 방문목욕" onToggle={() => t(["section9_desired", "bath"], "차량을 이용한 방문목욕")} />
          <Cb on={has(s9.bath, "차량을 이용하지 않은 방문목욕")} label="차량을 이용하지 않은 방문목욕" onToggle={() => t(["section9_desired", "bath"], "차량을 이용하지 않은 방문목욕")} />
        </div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">사. 복지용구</div>
        <div className="nf-row">
          희망품목( <EditInline value={(s9.aids ?? []).join(", ")} onChange={(v) => u(["section9_desired", "aids"], v.split(",").map((x: string) => x.trim()).filter(Boolean))} width={400} /> )
        </div>
        </div>

        <div className="nf-group">
          <div className="nf-sub-label">아. 장기요양급여 외 희망하는 지역사회 자원</div>
        <div className="nf-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          {[
            ["없음", "보건의료서비스(보건소, 치매안심센터 등)"],
            ["노인복지관", "이동지원서비스(차량지원, 무료택시 등)"],
            ["식사지원(급식 및 도시락 배달 등)", "이미용서비스"],
            ["주거지원서비스(도배, 장판, 주택개조 등)", "종교단체 지원"],
          ].flat().map((x) => (
            <div key={x}><Cb on={has(s9.community, x)} label={x} onToggle={() => t(["section9_desired", "community"], x)} /></div>
          ))}
          <div><Cb on={has(s9.community, "기타")} label="기타(" onToggle={() => t(["section9_desired", "community"], "기타")} /> )</div>
        </div>
        </div>

        <div className="nf-sub-label">자. 의견 및 판단근거</div>
        <EditText value={s9.opinion} onChange={(v) => u(["section9_desired", "opinion"], v)} heightMm={16} maxLen={150} />
      </div>

      <div className="nf-section-bar">10. 종합의견</div>
      <div className="nf-free nf-summary">
        <div className="nf-sub-label">1. 건강상태</div>
        <EditText value={s10.health} onChange={(v) => u(["section10_summary", "health"], v)} heightMm={14} maxLen={180} />
        <div className="nf-sub-label">2. 생활기능 및 신체기능</div>
        <EditText value={s10.function} onChange={(v) => u(["section10_summary", "function"], v)} heightMm={14} maxLen={180} />
        <div className="nf-sub-label">3. 인지 및 의사소통</div>
        <EditText value={s10.cognition} onChange={(v) => u(["section10_summary", "cognition"], v)} heightMm={14} maxLen={180} />
        <div className="nf-sub-label">4. 장기요양급여 제공계획서방향</div>
        <EditText value={s10.care_plan_direction} onChange={(v) => u(["section10_summary", "care_plan_direction"], v)} heightMm={14} maxLen={180} />
      </div>
    </section>
  );
}
