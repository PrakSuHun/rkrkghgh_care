"use client";

import { useState, useLayoutEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, Copy, Check, Loader2, Wand2, RefreshCw } from "lucide-react";

type DocSection = { label: string; text: string; type?: "text" | "table"; rows?: string[][]; headers?: string[] };
type DocOutput = { title: string; subtitle?: string; meta: DocSection[]; sections: DocSection[]; signature?: boolean };

function AutoTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm whitespace-pre-wrap bg-transparent resize-none border-0 focus:outline-none focus:bg-yellow-50 print:focus:bg-transparent rounded p-1 overflow-hidden"
      style={{ minHeight: "60px" }}
    />
  );
}

const TYPE_META: Record<string, { label: string; needSenior?: boolean; needWorker?: boolean; needMonth?: boolean; needFromTo?: boolean; needUserPrompt?: boolean }> = {
  needs_assessment: { label: "욕구사정지", needSenior: true },
  fall_assessment: { label: "낙상평가지", needSenior: true },
  senior_handover: { label: "수급자 인수인계서", needSenior: true, needFromTo: true },
  monthly_work_report: { label: "업무체계보고서", needSenior: true, needMonth: true, needUserPrompt: true },
};

export default function DocTypePage() {
  const { type } = useParams() as { type: string };
  const router = useRouter();
  const meta = TYPE_META[type];

  const { data: seniorsRes } = useSWR<{ data: any[] }>(meta?.needSenior ? "/api/seniors?status=active" : null);
  const { data: workersRes } = useSWR<{ caregivers: any[] }>((meta?.needWorker || meta?.needFromTo) ? "/api/workers?status=active" : null);

  const [seniorId, setSeniorId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [fromWorkerId, setFromWorkerId] = useState("");
  const [toWorkerId, setToWorkerId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [userPrompt, setUserPrompt] = useState("");

  const [doc, setDoc] = useState<DocOutput | null>(null);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);

  if (!meta) return <div className="p-6">알 수 없는 서류 유형</div>;

  const seniors = seniorsRes?.data ?? [];
  const workers = workersRes?.caregivers ?? [];

  const canSubmit =
    (!meta.needSenior || seniorId) &&
    (!meta.needWorker || workerId) &&
    (!meta.needMonth || /^\d{4}-\d{2}$/.test(month));

  const submit = async () => {
    if (type === "needs_assessment" && seniorId) {
      router.push(`/seniors/${seniorId}/needs-assessment?from=documents`);
      return;
    }
    if (type === "fall_assessment" && seniorId) {
      router.push(`/seniors/${seniorId}/fall-assessment/latest?from=documents`);
      return;
    }
    setGenerating(true); setErr(null);
    try {
      const body: any = { type };
      if (meta.needSenior) body.senior_id = seniorId;
      if (meta.needWorker) body.worker_id = workerId;
      if (meta.needMonth) body.month = month;
      if (meta.needFromTo) {
        if (fromWorkerId) body.from_worker_id = fromWorkerId;
        if (meta.needUserPrompt && userPrompt.trim()) body.user_prompt = userPrompt.trim();
        if (toWorkerId) body.to_worker_id = toWorkerId;
      }
      const res = await fetch("/api/documents/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "생성 실패");
      setDoc(j.doc);
      await fetch("/api/saved-documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: type, title: `${meta.label}${seniorId ? "" : ""}`,
          senior_id: seniorId ? Number(seniorId) : null,
          worker_id: workerId ? Number(workerId) : null,
          month: month || null, content: j.doc,
        }),
      });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateSection = (idx: number, text: string) => {
    if (!doc) return;
    const sections = [...doc.sections];
    sections[idx] = { ...sections[idx], text };
    setDoc({ ...doc, sections });
  };

  const refine = async () => {
    if (!doc || !instruction.trim()) return;
    setRefining(true);
    try {
      const res = await fetch("/api/documents/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc, instruction }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setDoc(j.doc);
      setInstruction("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRefining(false);
    }
  };

  const copy = async () => {
    if (!doc) return;
    const text = [
      doc.title, doc.subtitle ?? "", "",
      ...doc.meta.map((m) => `${m.label}: ${m.text}`), "",
      ...doc.sections.flatMap((s) => {
        if (s.type === "table") {
          const head = s.headers?.join("\t") ?? "";
          const body = (s.rows ?? []).map((r) => r.join("\t")).join("\n");
          return [`[${s.label}]`, head, body, ""];
        }
        return [`[${s.label}]`, s.text, ""];
      }),
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="no-print px-4 py-3 sm:p-6 max-w-4xl mx-auto space-y-4">
        <Link href="/documents" className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 서류 목록
        </Link>

        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h1 className="text-lg font-bold">{meta.label}</h1>
          <div className="grid sm:grid-cols-2 gap-3">
            {meta.needSenior && (
              <div>
                <label className="text-xs text-gray-500">어르신</label>
                <select value={seniorId} onChange={(e) => setSeniorId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">선택</option>
                  {seniors.map((s: any) => <option key={s.id} value={s.id}>{s.name} · {s.grade ?? "등급-"}</option>)}
                </select>
              </div>
            )}
            {meta.needWorker && (
              <div>
                <label className="text-xs text-gray-500">요양보호사</label>
                <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">선택</option>
                  {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            {meta.needMonth && (
              <div>
                <label className="text-xs text-gray-500">년월</label>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            )}
            {meta.needFromTo && (
              <>
                <div>
                  <label className="text-xs text-gray-500">전임 요양사 (선택)</label>
                  <select value={fromWorkerId} onChange={(e) => setFromWorkerId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">선택 안 함</option>
                    {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">후임 요양사 (선택)</label>
                  <select value={toWorkerId} onChange={(e) => setToWorkerId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">선택 안 함</option>
                    {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
          {meta.needUserPrompt && (
            <div>
              <label className="text-xs text-gray-500">어떤 내용으로 작성할지 간단히 입력 (선택)</label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="예: 이달 식사량이 줄어 체중 관리가 필요한 부분 강조 / 낙상 예방 관점에서 보행 관찰 중심"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!canSubmit || generating}
              className="flex-1 min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 작성 중...</> : doc ? <><RefreshCw className="w-4 h-4" /> 다시 작성</> : "AI로 작성하기"}
            </button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </div>

      {doc && (
        <>
          <div className="no-print max-w-4xl mx-auto px-4 mb-3 flex gap-2 justify-end">
            <button onClick={copy} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1">
              {copied ? <><Check className="w-4 h-4 text-green-600" /> 복사됨</> : <><Copy className="w-4 h-4" /> 복사</>}
            </button>
            <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
              <Printer className="w-4 h-4" /> 인쇄
            </button>
          </div>

          <article className="print-sheet max-w-4xl mx-auto bg-white border rounded-xl p-6 sm:p-10 mb-4">
            <header className="text-center border-b-2 border-black pb-3 mb-5">
              <h1 className="text-2xl font-bold">{doc.title}</h1>
              {doc.subtitle && <p className="text-sm text-gray-600 mt-1">{doc.subtitle}</p>}
            </header>

            <table className="w-full border-collapse text-sm mb-5">
              <tbody>
                {doc.meta.map((m, i) => (
                  <tr key={i}>
                    <th className="border border-gray-300 bg-gray-50 text-left px-2 py-1 w-32 font-medium">{m.label}</th>
                    <td className="border border-gray-300 px-2 py-1">{m.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-4">
              {doc.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="text-sm font-bold border-l-4 border-indigo-500 pl-2 mb-1">{s.label}</h2>
                  {s.type === "table" ? (
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          {(s.headers ?? []).map((h, j) => (
                            <th key={j} className="border border-gray-300 bg-gray-50 px-1 py-1">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(s.rows ?? []).map((row, j) => (
                          <tr key={j}>
                            {row.map((cell, k) => (
                              <td key={k} className="border border-gray-300 px-1 py-1 align-top">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <AutoTextarea value={s.text} onChange={(v) => updateSection(i, v)} />
                  )}
                </section>
              ))}
            </div>

            {doc.signature && (
              <div className="mt-10 pt-4 border-t grid grid-cols-2 gap-10 text-sm">
                <div>
                  <p className="mb-10">수급자 (서명 또는 인)</p>
                  <p className="border-b border-black h-6"></p>
                </div>
                <div>
                  <p className="mb-10">기관장 (서명 또는 인)</p>
                  <p className="border-b border-black h-6"></p>
                </div>
              </div>
            )}

            <footer className="mt-6 text-xs text-gray-500 text-right">출력일: {new Date().toISOString().slice(0, 10)}</footer>
          </article>

          <div className="no-print max-w-4xl mx-auto px-4 pb-20">
            <div className="bg-white border rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> AI로 수정 — 원하는 변경을 자연어로 입력
              </p>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="예: 장기목표 2줄로 간결하게 / 긴급상황 대응에 119 연락 포함"
                rows={2}
                className="w-full border rounded-lg p-2 text-sm"
              />
              <button
                onClick={refine}
                disabled={refining || !instruction.trim()}
                className="w-full min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {refining ? <><Loader2 className="w-4 h-4 animate-spin" /> 적용 중...</> : "적용"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
