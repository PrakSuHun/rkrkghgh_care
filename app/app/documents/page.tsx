"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { FileText, Loader2, ChevronRight, Trash2 } from "lucide-react";
import { invalidate } from "@/lib/swr";

const SENIOR_DOCS = [
  { v: "needs_assessment", label: "욕구사정지" },
  { v: "care_plan", label: "장기요양급여 제공계획서" },
  { v: "monthly_status", label: "월간 상태기록지" },
  { v: "service_record", label: "급여제공기록지" },
  { v: "senior_handover", label: "수급자 인수인계서" },
  { v: "service_contract", label: "장기요양급여 이용계약서" },
];
const WORKER_DOCS = [
  { v: "monthly_counseling", label: "상담일지 월간보고" },
  { v: "monthly_work_report", label: "월간 업무보고서" },
];

type CLog = { id: number; caregiver_id: number; topic: string | null; summary: string | null; created_at: string; worker_name?: string };

export default function DocumentsPage() {
  const { data: workersRes } = useSWR<{ caregivers: any[] }>("/api/workers?status=active");
  const { data: logsRes, isLoading: logsLoading } = useSWR<{ logs: CLog[] }>("/api/counseling?limit=50");

  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const workers = workersRes?.caregivers ?? [];
  const logs = logsRes?.logs ?? [];

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(workers.map((w: any) => w.id)));
  const clearAll = () => setSelectedIds(new Set());

  const generate = async () => {
    if (!topic.trim()) { setErr("주제를 입력해주세요"); return; }
    if (selectedIds.size === 0) { setErr("요양보호사를 선택해주세요"); return; }
    setGenerating(true); setErr(null);
    try {
      const res = await fetch("/api/counseling/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, date, worker_ids: Array.from(selectedIds) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      invalidate("/api/counseling");
      setTopic(""); setSelectedIds(new Set());
      alert(`${j.count}건 상담일지 생성 완료`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const deleteLog = async (id: number) => {
    if (!confirm("이 상담일지를 삭제할까요?")) return;
    await fetch(`/api/counseling/${id}`, { method: "DELETE" });
    invalidate("/api/counseling");
  };

  return (
    <div className="px-4 py-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">서류</h1>
        <p className="text-sm text-gray-500 mt-1">AI로 서류를 작성하세요</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">대상자 서류</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SENIOR_DOCS.map((d) => (
            <Link key={d.v} href={`/documents/${d.v}`} className="min-h-[96px] bg-white border rounded-xl p-4 flex flex-col gap-2 active:bg-gray-50">
              <FileText className="w-6 h-6 text-indigo-600" />
              <p className="text-base font-semibold">{d.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">요양사 서류</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {WORKER_DOCS.map((d) => (
            <Link key={d.v} href={`/documents/${d.v}`} className="min-h-[96px] bg-white border rounded-xl p-4 flex flex-col gap-2 active:bg-gray-50">
              <FileText className="w-6 h-6 text-emerald-600" />
              <p className="text-base font-semibold">{d.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">요양보호사 상담일지 일괄 생성</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">상담 주제</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 교육 참여, 월례 상담, 안전교육"
              className="w-full border rounded-lg px-3 py-3 text-base mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">상담일</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">요양보호사 선택 ({selectedIds.size}명)</label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs px-2 py-1 bg-gray-100 active:bg-gray-300 rounded">전체</button>
              <button onClick={clearAll} className="text-xs px-2 py-1 bg-gray-100 active:bg-gray-300 rounded">해제</button>
            </div>
          </div>
          <div className="border rounded-lg p-2 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1">
            {workers.map((w: any) => (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                className={`min-h-[40px] text-sm rounded-lg px-2 ${selectedIds.has(w.id) ? "bg-indigo-600 text-white" : "bg-gray-50 active:bg-gray-200"}`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          onClick={generate}
          disabled={generating}
          className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 생성 중...</> : "상담일지 일괄 생성"}
        </button>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">생성된 상담일지</h2>
        {logsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">생성된 상담일지가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="bg-white border rounded-xl p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.topic ?? "주제 없음"} · {l.worker_name ?? `요양사#${l.caregiver_id}`}</p>
                  <p className="text-xs text-gray-500 truncate">{new Date(l.created_at).toLocaleDateString("ko-KR")}</p>
                  {l.summary && <p className="text-xs text-gray-700 mt-1 line-clamp-2">{l.summary}</p>}
                </div>
                <button onClick={() => deleteLog(l.id)} className="p-2 text-red-500 active:bg-red-50 rounded-lg shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
