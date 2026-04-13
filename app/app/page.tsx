"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserCheck, FileText, MessageSquare } from "lucide-react";

type Senior = { id: number; name: string };
type Worker = { id: number; name: string };
type Journal = {
  id: number;
  senior_id?: number;
  worker_id?: number;
  senior_name?: string;
  worker_name?: string;
  summary: string | null;
  status: string;
  created_at: number;
};

export default function DashboardPage() {
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recentJournals, setRecentJournals] = useState<Journal[]>([]);
  const [recentCounseling, setRecentCounseling] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, wRes, jRes, cRes] = await Promise.all([
          fetch("/api/seniors"),
          fetch("/api/workers"),
          fetch("/api/journals?limit=5"),
          fetch("/api/counseling?limit=5"),
        ]);
        if (sRes.ok) setSeniors((await sRes.json()).recipients ?? []);
        if (wRes.ok) setWorkers((await wRes.json()).caregivers ?? []);
        if (jRes.ok) setRecentJournals((await jRes.json()).journals ?? []);
        if (cRes.ok) setRecentCounseling((await cRes.json()).logs ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">재가센터 행정 관리 시스템</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/seniors">
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">활성 어르신</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{seniors.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>
        </Link>

        <Link href="/workers">
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">활성 요양보호사</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{workers.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">최근 어르신 일지</h2>
        </div>
        {recentJournals.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center bg-white border border-gray-200 rounded-xl">
            아직 작성된 일지가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {recentJournals.map((j) => (
              <Link key={j.id} href={`/seniors/${j.senior_id}`}>
                <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">{j.senior_name}</p>
                    <span className="text-xs text-gray-500">{new Date(j.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {j.status === "processing" ? "⏳ AI 변환 중..." : j.summary ?? ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-800">최근 상담 일지</h2>
        </div>
        {recentCounseling.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center bg-white border border-gray-200 rounded-xl">
            아직 작성된 상담일지가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {recentCounseling.map((c) => (
              <Link key={c.id} href={`/workers/${c.worker_id}`}>
                <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">{c.worker_name}</p>
                    <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {c.status === "processing" ? "⏳ AI 변환 중..." : c.summary ?? ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
