"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
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
  const [search, setSearch] = useState("");
  // 요양사 → 선택된 어르신 id. 복수 담당인 경우 팝업에서 확정
  // 값: 숫자 id → 해당 어르신, "none" → 특정 어르신 아님 (일반 상담)
  const [workerSeniorMap, setWorkerSeniorMap] = useState<Record<number, number | "none">>({});
  const [pickOpen, setPickOpen] = useState(false);
  const [pickCandidates, setPickCandidates] = useState<Record<string, Array<{ id: number; name: string; grade: string | null }>>>({});
  const [pickNeeded, setPickNeeded] = useState<number[]>([]);

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w: any) => (w.name ?? "").toLowerCase().includes(q));
  }, [workers, search]);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => setSelectedIds(new Set(filteredWorkers.map((w: any) => w.id)));
  const clearAll = () => setSelectedIds(new Set());

  const postGenerate = async (map: Record<number, number | "none">) => {
    const res = await fetch("/api/counseling/batch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, date, method, counselor, worker_ids: Array.from(selectedIds), worker_senior_map: map }),
    });
    const j = await res.json();
    if (res.status === 409 && j.error === "needs_senior_pick") {
      // 복수 담당인데 지정 안 된 요양사 있음 → 팝업 띄움
      setPickCandidates(j.candidates ?? {});
      setPickNeeded((j.workers_need_pick ?? []).map((n: any) => Number(n)));
      setPickOpen(true);
      return false;
    }
    if (!res.ok) throw new Error(j.error);
    invalidate("/api/saved-documents", "/api/counseling");
    router.push("/documents");
    return true;
  };

  const generate = async () => {
    if (selectedIds.size === 0) { setErr("요양보호사를 선택해주세요"); return; }
    setGenerating(true); setErr(null); setDone(false);
    try {
      await postGenerate(workerSeniorMap);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const confirmPicks = async () => {
    // 지정되지 않은 요양사가 있으면 경고 (어르신 id 또는 "none" 모두 유효한 선택)
    const missing = pickNeeded.filter((wid) => workerSeniorMap[wid] === undefined);
    if (missing.length > 0) {
      setErr(`${missing.length}명의 요양사에 대해 선택하지 않았습니다.`);
      return;
    }
    setErr(null);
    setGenerating(true);
    try {
      const ok = await postGenerate(workerSeniorMap);
      if (ok) setPickOpen(false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const workerName = (wid: number) => workers.find((w: any) => w.id === wid)?.name ?? `#${wid}`;

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
            <label className="text-xs text-gray-500">
              요양보호사 선택 ({selectedIds.size}명)
              {search && ` · 검색 결과 ${filteredWorkers.length}명`}
            </label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs px-2 py-1 bg-gray-100 active:bg-gray-300 rounded">
                {search ? "검색결과 선택" : "전체"}
              </button>
              <button onClick={clearAll} className="text-xs px-2 py-1 bg-gray-100 active:bg-gray-300 rounded">해제</button>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름으로 검색"
              className="w-full pl-8 pr-7 py-2 border rounded-lg text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 active:text-gray-700" aria-label="검색 지우기">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="border rounded-lg p-2 max-h-60 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1">
            {filteredWorkers.length === 0 ? (
              <p className="col-span-full text-center text-sm text-gray-400 py-4">검색 결과가 없습니다</p>
            ) : (
              filteredWorkers.map((w: any) => (
                <button key={w.id} onClick={() => toggle(w.id)} className={`min-h-[44px] text-sm rounded-lg px-2 ${selectedIds.has(w.id) ? "bg-indigo-600 text-white" : "bg-gray-50 active:bg-gray-200"}`}>
                  {w.name}
                </button>
              ))
            )}
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {done && <p className="text-sm text-green-600">상담일지 생성 완료! 서류 목록에서 확인하세요.</p>}

        <button onClick={generate} disabled={generating} className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 생성 중...</> : "상담일지 일괄 생성"}
        </button>
      </section>

      {pickOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">어르신 선택 필요</h3>
              <button onClick={() => setPickOpen(false)} className="p-2 active:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              아래 요양보호사들은 담당 어르신이 여러 분입니다.<br />
              이번 상담일지가 <b>어느 어르신에 대한</b> 건인지 각각 선택해주세요. 선택한 어르신의 과거 상담 내용만 이번 작성에 참고됩니다.
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {pickNeeded.map((wid) => {
                const cands = pickCandidates[String(wid)] ?? [];
                return (
                  <div key={wid} className="border rounded-lg p-3">
                    <p className="text-sm font-semibold mb-2">{workerName(wid)}</p>
                    <div className="space-y-1.5">
                      {cands.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg border active:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name={`pick-${wid}`}
                            checked={workerSeniorMap[wid] === s.id}
                            onChange={() => setWorkerSeniorMap((p) => ({ ...p, [wid]: s.id }))}
                          />
                          <span className="text-sm">{s.name}{s.grade ? ` · ${s.grade}` : ""}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 p-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 active:bg-amber-100 cursor-pointer">
                        <input
                          type="radio"
                          name={`pick-${wid}`}
                          checked={workerSeniorMap[wid] === "none"}
                          onChange={() => setWorkerSeniorMap((p) => ({ ...p, [wid]: "none" }))}
                        />
                        <span className="text-sm text-amber-900">특정 어르신 아님 (일반 상담 · 교육·근무태도·컨디션 등)</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
            <div className="flex gap-2 pt-3">
              <button onClick={() => setPickOpen(false)} disabled={generating} className="flex-1 min-h-[44px] bg-gray-100 active:bg-gray-300 rounded-lg text-sm disabled:opacity-50">취소</button>
              <button onClick={confirmPicks} disabled={generating} className="flex-1 min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 생성 중...</> : "확인 후 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
