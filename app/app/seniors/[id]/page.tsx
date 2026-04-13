"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, FileText, Loader2, Trash2 } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";

export default function SeniorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/seniors/${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

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
          <p className="text-xs text-gray-500 mb-1">담당 요양보호사</p>
          {assignments.length === 0 ? (
            <p className="text-sm text-amber-600">배정된 요양보호사가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignments.map((a: any) => (
                <span key={a.id} className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
                  {a.caregivers?.name}
                </span>
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
              <div key={j.id} className="border border-gray-200 rounded-lg p-4">
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
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">📋 AI 일지 요약</p>
                    <p className="text-sm whitespace-pre-wrap bg-indigo-50 p-3 rounded">{j.summary}</p>
                  </div>
                )}
                {j.transcript && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-gray-500">원본 텍스트 보기</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{j.transcript}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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

