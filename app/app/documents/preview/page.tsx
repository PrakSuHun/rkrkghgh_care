"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Copy, Check, Loader2, Wand2 } from "lucide-react";

type DocSection = { label: string; text: string };
type DocOutput = { title: string; subtitle?: string; meta: DocSection[]; sections: DocSection[] };

export default function PreviewPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const type = sp.get("type") ?? "";
  const seniorId = sp.get("seniorId");
  const workerId = sp.get("workerId");
  const month = sp.get("month");

  const [doc, setDoc] = useState<DocOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/documents/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, senior_id: seniorId, worker_id: workerId, month }),
        });
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(j.error || "생성 실패");
        setDoc(j.doc);
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, seniorId, workerId, month]);

  const fullText = () => {
    if (!doc) return "";
    return [
      doc.title,
      doc.subtitle ?? "",
      "",
      ...doc.meta.map((m) => `${m.label}: ${m.text}`),
      "",
      ...doc.sections.flatMap((s) => [`[${s.label}]`, s.text, ""]),
    ].filter(Boolean).join("\n");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(fullText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500">AI가 서류를 작성 중입니다...</p>
      </div>
    );
  }
  if (err) return <div className="p-6 text-red-600">오류: {err}</div>;
  if (!doc) return null;

  return (
    <>
      <div className="no-print px-4 py-3 sm:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={() => router.back()} className="inline-flex items-center text-sm text-gray-600">
            <ArrowLeft className="w-4 h-4 mr-1" /> 뒤로
          </button>
          <div className="flex gap-2">
            <button onClick={copy} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1">
              {copied ? <><Check className="w-4 h-4 text-green-600" /> 복사됨</> : <><Copy className="w-4 h-4" /> 복사</>}
            </button>
            <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
              <Printer className="w-4 h-4" /> 인쇄
            </button>
          </div>
        </div>
      </div>

      <article className="print-sheet max-w-3xl mx-auto bg-white border rounded-xl p-6 sm:p-8 mb-4">
        <header className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          {doc.subtitle && <p className="text-sm text-gray-600 mt-1">{doc.subtitle}</p>}
        </header>

        <section className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-5">
          {doc.meta.map((m, i) => (
            <div key={i} className="flex gap-2 border-b pb-1">
              <span className="text-gray-500 shrink-0 min-w-20">{m.label}</span>
              <span className="font-medium break-all">{m.text}</span>
            </div>
          ))}
        </section>

        <div className="space-y-4">
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-sm font-bold text-gray-800 border-l-4 border-indigo-500 pl-2 mb-1">{s.label}</h2>
              <textarea
                value={s.text}
                onChange={(e) => updateSection(i, e.target.value)}
                rows={Math.max(2, (s.text.match(/\n/g)?.length ?? 0) + 2)}
                className="w-full text-sm text-gray-800 whitespace-pre-wrap bg-transparent resize-y border-0 focus:outline-none focus:bg-yellow-50 print:focus:bg-transparent rounded p-1"
              />
            </section>
          ))}
        </div>

        <footer className="mt-8 pt-4 border-t text-xs text-gray-500 text-right">
          작성일: {new Date().toISOString().slice(0, 10)}
        </footer>
      </article>

      <div className="no-print max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-white border rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> AI로 수정 — 원하는 변경을 자연어로 입력
          </p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="예: 결정사항 부분을 더 간결하게 / 다음 회의일을 5월 15일로"
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
  );
}
