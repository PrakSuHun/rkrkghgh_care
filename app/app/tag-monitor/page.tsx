"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";

type TagRecord = {
  id: number;
  raw_data: string;
  source_url: string;
  collected_at: number;
  status: string;
};

export default function TagMonitorPage() {
  const [records, setRecords] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/tags");
    if (res.ok) setRecords((await res.json()).records);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">태그 모니터링</h1>
          <p className="text-sm text-gray-500 mt-1">공단 시스템에서 수집된 태그 기록</p>
        </div>
        <button onClick={load} className="inline-flex items-center px-3 py-2 bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">크롬 확장프로그램 설치 필요</p>
          <p className="text-amber-800">
            공단 장기요양시스템에 로그인한 상태에서 CareLink 크롬 확장프로그램의 &quot;태그 수집&quot; 버튼을 누르면 이 페이지에 자동으로 나타납니다.
          </p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          아직 수집된 태그 기록이 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">수집 시각</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">데이터</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">상태</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const data = JSON.parse(r.raw_data);
                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(r.collected_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {(data.raw ?? []).map((cell: string, i: number) => (
                          <span key={i} className="bg-gray-100 px-2 py-0.5 rounded text-xs">{cell}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">{r.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
