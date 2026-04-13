"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MessageSquare, Loader2 } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";

type Worker = {
  id: number;
  name: string;
  phone: string | null;
  license_number: string | null;
  hire_date: string | null;
};

type Log = {
  id: number;
  transcript: string | null;
  summary: string | null;
  status: string;
  duration: number;
  created_at: number;
};

export default function WorkerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workers/${id}`);
    if (res.ok) {
      const data = await res.json();
      setWorker(data.worker);
      setLogs(data.logs);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!worker) return <div className="p-6">요양보호사를 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/workers" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{worker.name}</h1>
            <p className="text-sm text-gray-500 mt-1">요양보호사 #{worker.id}</p>
          </div>
          <button
            onClick={() => setRecordOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Mic className="w-4 h-4 mr-2" />
            상담 녹음 시작
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><p className="text-xs text-gray-500">연락처</p><p className="font-medium">{worker.phone ?? "-"}</p></div>
          <div><p className="text-xs text-gray-500">자격증 번호</p><p className="font-medium">{worker.license_number ?? "-"}</p></div>
          <div><p className="text-xs text-gray-500">입사일</p><p className="font-medium">{worker.hire_date ?? "-"}</p></div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">상담 일지</h2>
          </div>
          <span className="text-sm text-gray-500">총 {logs.length}건</span>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            아직 작성된 상담일지가 없습니다.<br />
            상단의 &quot;상담 녹음 시작&quot; 버튼을 눌러 첫 상담일지를 작성하세요.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">
                    {new Date(l.created_at).toLocaleString("ko-KR")} · {Math.floor(l.duration / 60)}분 {l.duration % 60}초
                  </p>
                  {l.status === "processing" && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      변환 중
                    </span>
                  )}
                  {l.status === "done" && <span className="text-xs text-green-600">완료</span>}
                  {l.status === "failed" && <span className="text-xs text-red-600">실패</span>}
                </div>
                {l.summary && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">📋 AI 상담일지 요약</p>
                    <p className="text-sm whitespace-pre-wrap bg-emerald-50 p-3 rounded">{l.summary}</p>
                  </div>
                )}
                {l.transcript && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-gray-500">원본 텍스트 보기</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{l.transcript}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <RecordingDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title={`${worker.name} 요양보호사 상담 녹음`}
        uploadUrl="/api/counseling"
        uploadField="worker_id"
        entityId={worker.id}
        onComplete={load}
      />
    </div>
  );
}
