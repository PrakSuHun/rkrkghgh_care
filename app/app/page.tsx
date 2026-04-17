"use client";

import { useState } from "react";
import useSWR from "swr";
import { Mic, Search, X, PenLine } from "lucide-react";
import QuickRecordCard from "./components/QuickRecordCard";
import SeniorSummaryCard from "./components/SeniorSummaryCard";
import ManualJournalDialog from "./components/ManualJournalDialog";

export default function DashboardPage() {
  const [openSenior, setOpenSenior] = useState(false);
  const [openManual, setOpenManual] = useState(false);

  const { data } = useSWR<{ data: any[] }>("/api/seniors");
  const seniors = data?.data ?? [];
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<any | null>(null);

  const filtered = q
    ? seniors.filter((s) => s.name.includes(q)).slice(0, 30)
    : [...seniors].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">재가센터 행정 관리 시스템</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setOpenSenior(true)}
          className="bg-indigo-600 active:bg-indigo-800 text-white rounded-2xl p-5 shadow-sm text-left"
        >
          <Mic className="w-6 h-6 mb-2" />
          <p className="text-base font-semibold">녹음</p>
          <p className="text-xs opacity-80 mt-0.5">어르신 돌봄 상태 녹음</p>
        </button>
        <button
          onClick={() => setOpenManual(true)}
          className="bg-emerald-600 active:bg-emerald-800 text-white rounded-2xl p-5 shadow-sm text-left"
        >
          <PenLine className="w-6 h-6 mb-2" />
          <p className="text-base font-semibold">수기 작성</p>
          <p className="text-xs opacity-80 mt-0.5">직접 입력해 저장</p>
        </button>
      </div>

      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 pointer-events-none" />
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
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPicked(s)}
                    className="h-12 px-2 rounded-xl bg-gray-100 active:bg-indigo-600 active:text-white text-sm font-medium flex items-center justify-center text-center truncate"
                  >
                    {s.name}
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
        title="대상자 일지"
        listUrl="/api/seniors"
        listField="recipients"
        uploadUrl="/api/journals"
        uploadField="senior_id"
        accent="indigo"
        onComplete={() => {}}
      />
      <ManualJournalDialog open={openManual} onClose={() => setOpenManual(false)} />
    </div>
  );
}
