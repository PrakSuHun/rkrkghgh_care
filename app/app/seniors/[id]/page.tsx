"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, FileText, Loader2 } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";

type Senior = {
  id: number;
  name: string;
  birth_date: string | null;
  care_level: number | null;
  long_term_care_id: string | null;
  address: string | null;
  guardian_phone: string | null;
  diseases: string[];
  physical_status: string | null;
  mobility: string | null;
  cognitive_memory: string | null;
  cognitive_behavior: string | null;
  essential_services: string[];
  external_support: string | null;
};

type Journal = {
  id: number;
  transcript: string | null;
  summary: string | null;
  status: string;
  duration: number;
  created_at: number;
};

export default function SeniorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [senior, setSenior] = useState<Senior | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/seniors/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSenior(data.senior);
      setJournals(data.journals);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000); // processing 중이면 3초마다 폴링
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!senior) return <div className="p-6">어르신을 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/seniors" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{senior.name}</h1>
            <p className="text-sm text-gray-500 mt-1">어르신 #{senior.id}</p>
          </div>
          <button
            onClick={() => setRecordOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Mic className="w-4 h-4 mr-2" />
            녹음 시작
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><p className="text-xs text-gray-500">요양등급</p><p className="font-medium">{senior.care_level ?? "-"}등급</p></div>
          <div><p className="text-xs text-gray-500">생년월일</p><p className="font-medium">{senior.birth_date ?? "-"}</p></div>
          <div><p className="text-xs text-gray-500">장기요양번호</p><p className="font-medium">{senior.long_term_care_id ?? "-"}</p></div>
          <div><p className="text-xs text-gray-500">주거형태</p><p className="font-medium">{senior.address ?? "-"}</p></div>
        </div>

        {senior.diseases?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">주요 질환</p>
            <div className="flex flex-wrap gap-2">
              {senior.diseases.map((d) => (
                <span key={d} className="bg-red-50 text-red-700 text-xs px-2 py-1 rounded">{d}</span>
              ))}
            </div>
          </div>
        )}

        {senior.physical_status && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">신체 상태</p>
            <p className="text-sm text-gray-800">{senior.physical_status}</p>
          </div>
        )}

        {senior.mobility && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">거동</p>
            <p className="text-sm text-gray-800">{senior.mobility}</p>
          </div>
        )}

        {senior.cognitive_memory && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">인지 상태</p>
            <p className="text-sm text-gray-800">{senior.cognitive_memory}</p>
            {senior.cognitive_behavior && <p className="text-sm text-gray-800 mt-1">{senior.cognitive_behavior}</p>}
          </div>
        )}

        {senior.essential_services?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">필수 서비스</p>
            <ul className="text-sm text-gray-800 list-disc list-inside space-y-0.5">
              {senior.essential_services.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">누적 일지</h2>
          </div>
          <span className="text-sm text-gray-500">총 {journals.length}건</span>
        </div>

        {journals.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            아직 작성된 일지가 없습니다.<br />
            상단의 &quot;녹음 시작&quot; 버튼을 눌러 첫 일지를 작성하세요.
          </div>
        ) : (
          <div className="space-y-3">
            {journals.map((j) => (
              <div key={j.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">
                    {new Date(j.created_at).toLocaleString("ko-KR")} · {Math.floor(j.duration / 60)}분 {j.duration % 60}초
                  </p>
                  {j.status === "processing" && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      변환 중
                    </span>
                  )}
                  {j.status === "done" && <span className="text-xs text-green-600">완료</span>}
                  {j.status === "failed" && <span className="text-xs text-red-600">실패</span>}
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
      </div>

      <RecordingDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title={`${senior.name} 어르신 일지 녹음`}
        uploadUrl="/api/journals"
        uploadField="senior_id"
        entityId={senior.id}
        onComplete={load}
      />
    </div>
  );
}
