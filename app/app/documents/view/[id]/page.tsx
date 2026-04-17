"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, Copy, Check, Trash2, Loader2, RefreshCw, Wand2, Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { invalidate } from "@/lib/swr";
import { CENTER_INFO } from "@/lib/centerInfo";

const WRITER_LABELS = new Set(["작성자", "상담자", "상담자명", "사회복지사"]);

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

function TextCell({ value, onChange, multiline, rows = 3, label }: { value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number; label?: string }) {
  if (label && WRITER_LABELS.has(label) && !multiline) {
    return <WriterSelect value={value ?? ""} onChange={onChange} />;
  }
  if (multiline) {
    return (
      <textarea
        className="w-full border rounded px-2 py-1 text-sm bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className="w-full border rounded px-2 py-1 text-sm bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function SavedDocViewPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from");
  const wid = sp.get("wid");
  const backUrl = from === "worker" && wid ? `/workers/${wid}` : "/documents";
  const backLabel = from === "worker" ? "요양사로" : "서류 목록";
  const { data, mutate } = useSWR<any>(`/api/saved-documents/${id}`);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [contentOverride, setContentOverride] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  if (!data) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  const doc = data.document;
  const savedContent = contentOverride ?? doc.content ?? {};
  const content = editMode && draft ? draft : savedContent;
  const setContent = setContentOverride;

  const updateDraft = (mutator: (d: any) => void) => {
    setDraft((prev: any) => {
      const next = structuredClone(prev ?? savedContent);
      mutator(next);
      return next;
    });
  };
  const updateMetaText = (i: number, text: string) => updateDraft((d) => { d.meta[i].text = text; });
  const updateSectionText = (i: number, text: string) => updateDraft((d) => { d.sections[i].text = text; });
  const updateField = (key: string, val: string) => updateDraft((d) => { d[key] = val; });
  const updateMetaByLabel = (label: string, val: string) => updateDraft((d) => {
    const idx = (d.meta ?? []).findIndex((m: any) => m.label === label);
    if (idx >= 0) d.meta[idx].text = val;
  });

  const startEdit = () => {
    setDraft(structuredClone(savedContent));
    setEditMode(true);
  };
  const cancelEdit = () => {
    setDraft(null);
    setEditMode(false);
  };
  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/saved-documents/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setContent(draft);
      setDraft(null);
      setEditMode(false);
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fullText = () => {
    if (content.title) {
      return [
        content.title, content.subtitle ?? "", "",
        ...(content.meta ?? []).map((m: any) => `${m.label}: ${m.text}`), "",
        ...(content.sections ?? []).flatMap((s: any) => [`[${s.label}]`, s.text, ""]),
      ].filter(Boolean).join("\n");
    }
    if (content.summary) return `${doc.title}\n\n상담내용: ${content.summary}\n조치사항: ${content.action ?? ""}\n이전 조치사항 이행결과: ${content.prev_result ?? ""}`;
    return JSON.stringify(content, null, 2);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(fullText());
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const del = async () => {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/saved-documents/${id}`, { method: "DELETE" });
    invalidate("/api/saved-documents");
    router.push("/documents");
  };

  const refine = async () => {
    if (!chatInput.trim()) return;
    setRefining(true);
    try {
      const res = await fetch("/api/documents/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: content, instruction: chatInput }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setContent(j.doc);
      await fetch(`/api/saved-documents/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: j.doc }),
      });
      setChatInput("");
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRefining(false);
    }
  };

  const regenerate = async () => {
    if (!confirm("AI로 다시 생성할까요? 현재 내용이 덮어써집니다.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: doc.doc_type,
          senior_id: doc.senior_id,
          worker_id: doc.worker_id,
          month: doc.month,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setContent(j.doc);
      await fetch(`/api/saved-documents/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: j.doc }),
      });
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      <div className="no-print px-4 py-3 max-w-4xl mx-auto flex items-center justify-between gap-2">
        <Link href={backUrl} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
        </Link>
        <div className="flex gap-2 flex-wrap justify-end">
          {editMode ? (
            <>
              <button onClick={cancelEdit} disabled={saving} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                <X className="w-4 h-4" /> 취소
              </button>
              <button onClick={saveEdit} disabled={saving} className="min-h-[40px] px-3 py-2 bg-green-600 active:bg-green-800 text-white rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1">
                <Pencil className="w-4 h-4" /> 편집
              </button>
              <button onClick={regenerate} disabled={regenerating} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} /> 재생성
              </button>
              <button onClick={copy} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1">
                {copied ? <><Check className="w-4 h-4 text-green-600" /> 복사됨</> : <><Copy className="w-4 h-4" /> 복사</>}
              </button>
              <button onClick={del} className="min-h-[40px] p-2 text-red-500 active:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
                <Printer className="w-4 h-4" /> 인쇄
              </button>
            </>
          )}
        </div>
      </div>

      <article className="print-sheet max-w-4xl mx-auto bg-white border rounded-xl p-6 sm:p-10 mb-4">
        {doc.doc_type === "monthly_work_report" && Array.isArray(content.meta) ? (() => {
          const m = Object.fromEntries(content.meta.map((x: any) => [x.label, x.text]));
          const setByLabel = (label: string) => (val: string) => updateMetaByLabel(label, val);
          return (
            <div>
              <h1 className="text-xl font-bold text-center mb-6">업무체계보고서</h1>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-50 px-3 py-3 w-28 text-center align-middle">대상자</th>
                    <td className="border border-black px-3 py-3">
                      {editMode ? (
                        <div className="flex gap-2 items-center">
                          <TextCell value={m.senior_name ?? ""} onChange={setByLabel("senior_name")} />
                          <TextCell value={m.grade ?? ""} onChange={setByLabel("grade")} />
                        </div>
                      ) : (
                        <>{m.senior_name} <span className="text-xs text-gray-500">({m.grade ?? "등급-"})</span></>
                      )}
                    </td>
                    <th className="border border-black bg-gray-50 px-3 py-3 w-28 text-center align-middle">담당 요양사</th>
                    <td className="border border-black px-3 py-3">
                      {editMode ? <TextCell value={m.worker_name ?? ""} onChange={setByLabel("worker_name")} /> : m.worker_name}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">기간</th>
                    <td className="border border-black px-3 py-3">
                      {editMode ? <TextCell value={m.month ?? ""} onChange={setByLabel("month")} /> : m.month}
                    </td>
                    <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">작성자</th>
                    <td className="border border-black px-3 py-3">
                      {editMode ? <TextCell value={m.writer ?? ""} onChange={setByLabel("writer")} label="작성자" /> : m.writer}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">대상자 상태</th>
                    <td className="border border-black px-4 py-4 whitespace-pre-wrap align-top" colSpan={3} style={{ height: editMode ? undefined : "80mm" }}>
                      {editMode ? <TextCell value={m.state ?? ""} onChange={setByLabel("state")} multiline rows={10} /> : m.state}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">요양보호사<br />조치사항</th>
                    <td className="border border-black px-4 py-4 whitespace-pre-wrap align-top" colSpan={3} style={{ height: editMode ? undefined : "45mm" }}>
                      {editMode ? <TextCell value={m.caregiver_action ?? ""} onChange={setByLabel("caregiver_action")} multiline rows={6} /> : m.caregiver_action}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">센터<br />조치사항</th>
                    <td className="border border-black px-4 py-4 whitespace-pre-wrap align-top" colSpan={3} style={{ height: editMode ? undefined : "45mm" }}>
                      {editMode ? <TextCell value={m.center_action ?? ""} onChange={setByLabel("center_action")} multiline rows={6} /> : m.center_action}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="text-center text-sm mt-6">
                <p>{editMode ? <TextCell value={m.date ?? ""} onChange={setByLabel("date")} /> : m.date}</p>
                <p className="mt-2">작성자 : {m.writer} &nbsp; (서명)</p>
              </div>
            </div>
          );
        })() : content.title ? (
          <>
            <header className="text-center border-b-2 border-black pb-3 mb-5">
              <h1 className="text-2xl font-bold">
                {editMode ? <TextCell value={content.title ?? ""} onChange={(v) => updateField("title", v)} /> : content.title}
              </h1>
              {(editMode || content.subtitle) && (
                <p className="text-sm text-gray-600 mt-1">
                  {editMode ? <TextCell value={content.subtitle ?? ""} onChange={(v) => updateField("subtitle", v)} /> : content.subtitle}
                </p>
              )}
            </header>
            {content.meta && (
              <table className="w-full border-collapse text-sm mb-5">
                <tbody>
                  {content.meta.map((mm: any, i: number) => (
                    <tr key={i}>
                      <th className="border border-gray-300 bg-gray-50 text-center align-middle px-2 py-1 w-32 font-medium">{mm.label}</th>
                      <td className="border border-gray-300 px-2 py-1">
                        {editMode ? <TextCell value={mm.text ?? ""} onChange={(v) => updateMetaText(i, v)} label={mm.label} /> : mm.text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {content.sections?.map((s: any, i: number) => (
              <section key={i} className="mb-3">
                <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-1">{s.label}</h2>
                {editMode ? (
                  <TextCell value={s.text ?? ""} onChange={(v) => updateSectionText(i, v)} multiline rows={Math.max(3, Math.min(12, Math.ceil((s.text ?? "").length / 50)))} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{s.text}</p>
                )}
              </section>
            ))}
            {content.signature && (
              <div className="mt-10 pt-4 border-t grid grid-cols-2 gap-10 text-sm">
                <div><p className="mb-10">수급자 (서명 또는 인)</p><p className="border-b border-black h-6"></p></div>
                <div><p className="mb-10">기관장 (서명 또는 인)</p><p className="border-b border-black h-6"></p></div>
              </div>
            )}
          </>
        ) : content.summary !== undefined ? (
          <div>
            <h1 className="text-xl font-bold text-center mb-6">요양보호사 상담일지</h1>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <th className="border border-black bg-gray-50 px-3 py-3 w-32 text-center align-middle">상담 요양보호사</th>
                  <td className="border border-black px-3 py-3">
                    {editMode ? <TextCell value={content.worker_name ?? ""} onChange={(v) => updateField("worker_name", v)} /> : (content.worker_name ?? doc.title)}
                  </td>
                  <th className="border border-black bg-gray-50 px-3 py-3 w-28 text-center align-middle">상담자명</th>
                  <td className="border border-black px-3 py-3">
                    {editMode ? <TextCell value={content.counselor ?? ""} onChange={(v) => updateField("counselor", v)} label="상담자명" /> : (content.counselor ?? "권오성")}
                  </td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">상담일자</th>
                  <td className="border border-black px-3 py-3">
                    {editMode ? <TextCell value={content.date ?? ""} onChange={(v) => updateField("date", v)} /> : (content.date ?? "")}
                  </td>
                  <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">상담방법</th>
                  <td className="border border-black px-3 py-3">
                    {editMode ? <TextCell value={content.method ?? ""} onChange={(v) => updateField("method", v)} /> : (content.method ?? "대면")}
                  </td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">상담내용</th>
                  <td className="border border-black px-4 py-4 whitespace-pre-wrap align-top" colSpan={3} style={{ height: editMode ? undefined : "90mm" }}>
                    {editMode ? <TextCell value={content.summary ?? ""} onChange={(v) => updateField("summary", v)} multiline rows={12} /> : content.summary}
                  </td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">
                    조치사항
                    <div className="mt-2 text-xs font-normal">
                      {content.action && content.action !== "해당 없음" ? "[✓] 유  [ ] 무" : "[ ] 유  [✓] 무"}
                    </div>
                  </th>
                  <td className="border border-black px-4 py-4 whitespace-pre-wrap align-top" colSpan={3} style={{ height: editMode ? undefined : "35mm" }}>
                    {editMode ? (
                      <TextCell value={content.action ?? ""} onChange={(v) => updateField("action", v)} multiline rows={4} />
                    ) : (
                      content.action && content.action !== "해당 없음" ? content.action : ""
                    )}
                  </td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-50 px-3 py-3 text-center align-middle">이전 조치사항<br />이행결과</th>
                  <td className="border border-black px-4 py-4 whitespace-pre-wrap align-top" colSpan={3} style={{ height: editMode ? undefined : "35mm" }}>
                    {editMode ? <TextCell value={content.prev_result ?? ""} onChange={(v) => updateField("prev_result", v)} multiline rows={4} /> : (content.prev_result ?? "해당 없음")}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="text-center text-sm mt-6">
              <p>{content.date}</p>
              <p className="mt-2">상담자 : {content.counselor ?? "권오성"} &nbsp; (서명)</p>
            </div>
          </div>
        ) : (
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
        )}

        <footer className="mt-8 pt-4 border-t text-xs text-gray-500 text-right no-print">
          생성일: {new Date(doc.created_at).toLocaleDateString("ko-KR")}
        </footer>
      </article>

      {!editMode && (
        <div className="no-print max-w-4xl mx-auto px-4 pb-20">
          <div className="bg-white border rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> AI로 수정 — 원하는 변경을 자연어로 입력
            </p>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="예: 상담내용을 좀 더 구체적으로 / 조치사항 추가해줘"
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
