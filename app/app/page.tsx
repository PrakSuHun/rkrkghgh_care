"use client";

import { useEffect, useState } from "react";
import { Mic, MessageSquare, Search, X } from "lucide-react";
import QuickRecordCard from "./components/QuickRecordCard";
import SeniorSummaryCard from "./components/SeniorSummaryCard";

export default function DashboardPage() {
  const [openSenior, setOpenSenior] = useState(false);
  const [openWorker, setOpenWorker] = useState(false);

  const [seniors, setSeniors] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/seniors").then((r) => r.json()).then((j) => setSeniors(j.data ?? []));
  }, []);

  const filtered = q
    ? seniors.filter((s) => s.name.includes(q)).slice(0, 30)
    : [...seniors].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">재가센터 행정 관리 시스템</p>
      </div>

      {/* 빠른 녹음 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setOpenSenior(true)}
          className="bg-indigo-600 active:bg-indigo-800 text-white rounded-2xl p-5 shadow-sm text-left"
        >
          <Mic className="w-6 h-6 mb-2" />
          <p className="text-base font-semibold">대상자 상태일지</p>
          <p className="text-xs opacity-80 mt-0.5">어르신 돌봄 녹음</p>
        </button>
        <button
          onClick={() => setOpenWorker(true)}
          className="bg-emerald-600 active:bg-emerald-800 text-white rounded-2xl p-5 shadow-sm text-left"
        >
          <MessageSquare className="w-6 h-6 mb-2" />
          <p className="text-base font-semibold">요양사 상담일지</p>
          <p className="text-xs opacity-80 mt-0.5">요양보호사 상담 녹음</p>
        </button>
      </div>

      {/* 어르신 검색 (10영역 복사용) */}
      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
          <input
            type="search"
            inputMode="search"
            placeholder="어르신 이름 검색"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPicked(null); }}
            className="w-full pl-10 pr-9 py-3 border rounded-xl text-base"
          />
          {q && (
            <button onClick={() => { setQ(""); setPicked(null); }} className="absolute right-2 top-2.5 p-1">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {!picked && (
          <div>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">검색 결과 없음</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPicked(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 active:bg-indigo-600 active:text-white text-sm font-medium"
                  >
                    <span>{s.name}</span>
                    {s.grade && <span className="text-xs text-gray-500">{s.grade}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {picked && <SeniorSummaryCard senior={picked} onUpdated={(u) => setPicked(u)} />}

      <QuickRecordCard
        open={openSenior}
        onClose={() => setOpenSenior(false)}
        title="대상자 상태일지"
        listUrl="/api/seniors"
        listField="recipients"
        uploadUrl="/api/journals"
        uploadField="senior_id"
        accent="indigo"
        onComplete={() => {}}
      />
      <QuickRecordCard
        open={openWorker}
        onClose={() => setOpenWorker(false)}
        title="요양사 상담일지"
        listUrl="/api/workers"
        listField="caregivers"
        uploadUrl="/api/counseling"
        uploadField="worker_id"
        accent="emerald"
        onComplete={() => {}}
      />
    </div>
  );
}
