"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { invalidate } from "@/lib/swr";
import Link from "next/link";
import { ArrowLeft, Mic, FileText, Loader2, Trash2, Repeat, Plus, X } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";

type Worker = { id: number; name: string; phone: string | null };

export default function SeniorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");

  const { data, mutate, isLoading } = useSWR<any>(`/api/seniors/${id}`, {
    refreshInterval: (d: any) => (d?.journals ?? []).some((j: any) => j.status === "processing") ? 3000 : 0,
  });
  const loading = isLoading;
  const load = () => {
    mutate();
    invalidate("/api/seniors", "/api/workers", "/api/assignments");
  };

  const openPicker = async (mode: "add" | any) => {
    if (mode === "add") setAddOpen(true);
    else setSwapFor(mode);
    setPickerSearch("");
    if (allWorkers.length === 0) {
      const r = await fetch("/api/workers?status=active");
      const j = await r.json();
      setAllWorkers((j.data ?? []).map((w: any) => ({ id: w.id, name: w.name, phone: w.phone })));
    }
  };

  const closePicker = () => { setSwapFor(null); setAddOpen(false); };

  const pickWorker = async (workerId: number) => {
    if (swapFor) {
      const res = await fetch(`/api/assignments/${swapFor.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caregiver_id: workerId }),
      });
      if (!res.ok) { alert("교체 실패"); return; }
    } else if (addOpen) {
      const res = await fetch(`/api/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senior_id: Number(id), caregiver_id: workerId,
          role: "주담당", start_date: new Date().toISOString().slice(0, 10), status: "active",
        }),
      });
      if (!res.ok) { alert("추가 실패"); return; }
    }
    closePicker();
    load();
  };

  const unassign = async (assignmentId: number) => {
    if (!confirm("배정을 해제할까요?")) return;
    const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    if (!res.ok) { alert("해제 실패"); return; }
    load();
  };

  const deleteJournal = async (journalId: number) => {
    if (!confirm("이 일지를 삭제할까요? (복구할 수 없습니다)")) return;
    const res = await fetch(`/api/journals/${journalId}`, { method: "DELETE" });
    if (!res.ok) { alert("삭제 실패"); return; }
    load();
  };

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!data?.senior) return <div className="p-6">어르신을 찾을 수 없습니다.</div>;

  const s = data.senior;
  const journals = data.journals ?? [];
  const assignments = (data.assignments ?? []).filter((a: any) => a.status === "active");
  const filtered = pickerSearch
    ? allWorkers.filter((w) => w.name.includes(pickerSearch))
    : allWorkers;

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/seniors" className="inline-flex items-center text-sm text-gray-600 active:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Link>

      <section className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{s.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{s.grade ?? "등급-"}</p>
          </div>
          <button
            onClick={() => setRecordOpen(true)}
            className="min-h-[44px] inline-flex items-center px-4 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium"
          >
            <Mic className="w-4 h-4 mr-2" /> 녹음 시작
          </button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">담당 요양보호사</p>
            <button
              onClick={() => openPicker("add")}
              className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg"
            >
              <Plus className="w-3 h-3" /> 추가
            </button>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-amber-600">배정된 요양보호사가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.caregivers?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{a.caregivers?.phone ?? ""}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openPicker(a)}
                      className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg"
                    >
                      <Repeat className="w-3 h-3" /> 교체
                    </button>
                    <button
                      onClick={() => unassign(a.id)}
                      className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-red-50 text-red-600 active:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold">돌봄 일지</h2>
          </div>
          <span className="text-xs text-gray-500">총 {journals.length}건</span>
        </div>
        {journals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">아직 작성된 일지가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {journals.map((j: any) => (
              <div key={j.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2 gap-2">
                  <p className="text-xs text-gray-500 min-w-0 truncate">
                    {new Date(j.created_at).toLocaleString("ko-KR")} · {Math.floor(j.duration / 60)}분 {j.duration % 60}초
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {j.status === "processing" && <span className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="w-3 h-3 animate-spin" /> 변환중</span>}
                    {j.status === "done" && <span className="text-xs text-green-600">완료</span>}
                    {j.status === "failed" && <span className="text-xs text-red-600">실패</span>}
                    <button
                      onClick={() => deleteJournal(j.id)}
                      className="min-h-[32px] p-2 text-red-500 active:bg-red-50 rounded-lg"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {j.summary && (
                  <p className="text-sm whitespace-pre-wrap bg-indigo-50 p-3 rounded">{j.summary}</p>
                )}
                {j.transcript && (
                  <details className="text-sm mt-2">
                    <summary className="cursor-pointer text-xs text-gray-500">원본 텍스트 보기</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{j.transcript}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {(swapFor || addOpen) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{swapFor ? "요양보호사 교체" : "요양보호사 추가"}</h3>
              <button onClick={closePicker} className="p-2 active:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <input
              type="search"
              inputMode="search"
              placeholder="이름으로 검색"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base mb-3"
            />
            <div className="flex-1 overflow-y-auto space-y-1">
              {filtered.map((w) => (
                <button
                  key={w.id}
                  onClick={() => pickWorker(w.id)}
                  className="w-full text-left min-h-[48px] px-3 py-2 active:bg-gray-100 rounded-lg flex items-center justify-between"
                >
                  <span className="font-medium">{w.name}</span>
                  <span className="text-xs text-gray-500">{w.phone ?? ""}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">결과가 없습니다</p>
              )}
            </div>
          </div>
        </div>
      )}

      <RecordingDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title={`${s.name} 어르신 일지 녹음`}
        uploadUrl="/api/journals"
        uploadField="senior_id"
        entityId={s.id}
        onComplete={load}
      />
    </div>
  );
}
