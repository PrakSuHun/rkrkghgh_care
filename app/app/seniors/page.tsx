"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, User, ChevronRight } from "lucide-react";

type Senior = {
  id: number;
  name: string;
  birth_date: string | null;
  grade: string | null;
  long_term_care_id: string | null;
  status: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  caregiver_names: string[];
  active_assignment_count: number;
  last_journal_at: string | null;
};

const GRADE_COLORS: Record<string, string> = {
  "1등급": "bg-red-100 text-red-700",
  "2등급": "bg-orange-100 text-orange-700",
  "3등급": "bg-yellow-100 text-yellow-700",
  "4등급": "bg-green-100 text-green-700",
  "5등급": "bg-blue-100 text-blue-700",
  "인지지원등급": "bg-purple-100 text-purple-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  ended: "종료",
  inactive: "비활성",
  suspended: "일시중단",
};

function fmtDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function age(birth: string | null): string {
  if (!birth) return "";
  const b = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return `${a}세`;
}

export default function SeniorsPage() {
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/seniors?${params}`);
    if (res.ok) {
      const j = await res.json();
      setSeniors(j.data ?? []);
      setTotal(j.total ?? 0);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수급자 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total}명</p>
        </div>
        <Link href="/seniors/new">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> 어르신 등록
          </button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg text-sm px-3 py-2 bg-white"
        >
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
          <option value="">전체</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : seniors.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">결과가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {seniors.map((s) => (
            <Link key={s.id} href={`/seniors/${s.id}`}>
              <div className="bg-white border rounded-xl p-4 hover:shadow-md transition cursor-pointer">
                <div className="grid grid-cols-[40px_72px_64px_1fr_auto] gap-3 items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                    {s.name.charAt(0)}
                  </div>
                  <div className="font-semibold truncate">{s.name}</div>
                  <div>
                    {s.grade ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${GRADE_COLORS[s.grade] ?? "bg-gray-100 text-gray-600"}`}>
                        {s.grade}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </div>
                  <div className="min-w-0 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      {s.birth_date && <span>{age(s.birth_date)}</span>}
                      {s.long_term_care_id && <span className="truncate">{s.long_term_care_id}</span>}
                      {s.status !== "active" && (
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate">
                      담당 {s.caregiver_names.length === 0 ? <span className="text-amber-600">미배정</span> : s.caregiver_names.join(", ")}
                      {s.last_journal_at && <span className="ml-2">· 최근 일지 {fmtDate(s.last_journal_at)}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
