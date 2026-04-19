"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { invalidate } from "@/lib/swr";

export default function CounselingPage() {
  const router = useRouter();
  const { data: workersRes } = useSWR<{ caregivers: any[] }>("/api/workers?status=active");
  const workers = workersRes?.caregivers ?? [];

  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("대면");
  const [counselor, setCounselor] = useState("박현식");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(workers.map((w: any) => w.id)));
  const clearAll = () => setSelectedIds(new Set());

  const generate = async () => {
    if (selectedIds.size === 0) { setErr("요양보호사를 선택해주세요"); return; }
    setGenerating(true); setErr(null); setDone(false);
    try {
      const res = await fetch("/api/counseling/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, date, method, counselor, worker_ids: Array.from(selectedIds) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      invalidate("/api/saved-documents", "/api/counseling");
      router.push("/documents");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/documents" className="inline-flex items-center text-sm text-gray-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> 서류 목록
      </Link>

      <h1 className="text-xl font-bold">요양보호사 상담일지 일괄 생성</h1>

      <section className="bg-white border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-gray-500">상담 주제 (AI 작성 참고용, 양식에는 표시 안 됨)</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 교육 참여, 월례 상담, 안전교육, 근무 태도" className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">상담일자</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500">상담방법</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
              <option value="대면">대면</option>
              <option value="유선">유선</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">상담자명</label>
            <select value={counselor} onChange={(e) => setCounselor(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
              <option value="박현식">박현식</option>
              <option value="권오성">권오성</option>
              <option value="봉현옥">봉현옥</option>
            </select>
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
          <div className="border rounded-lg p-2 max-h-60 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1">
            {workers.map((w: any) => (
              <button key={w.id} onClick={() => toggle(w.id)} className={`min-h-[44px] text-sm rounded-lg px-2 ${selectedIds.has(w.id) ? "bg-indigo-600 text-white" : "bg-gray-50 active:bg-gray-200"}`}>
                {w.name}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {done && <p className="text-sm text-green-600">상담일지 생성 완료! 서류 목록에서 확인하세요.</p>}

        <button onClick={generate} disabled={generating} className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 생성 중...</> : "상담일지 일괄 생성"}
        </button>
      </section>
    </div>
  );
}
