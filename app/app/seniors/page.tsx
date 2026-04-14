"use client";

import { useState } from "react";
import useSWR from "swr";
import { useDebounce } from "@/lib/useDebounce";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const debouncedSearch = useDebounce(search, 300);
  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter) params.set("status", statusFilter);
  const key = `/api/seniors?${params}`;
  const { data, isLoading } = useSWR<{ data: Senior[]; total: number }>(key, { keepPreviousData: true });
  const seniors = data?.data ?? [];
  const total = data?.total ?? 0;
  const loading = isLoading;

  return (
    <div className="px-4 py-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">수급자 관리</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">총 {total}명</p>
        </div>
        <Link href="/seniors/new">
          <button className="min-h-[44px] flex items-center gap-2 bg-blue-600 active:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> 등록
          </button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            inputMode="search"
            placeholder="이름으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg text-base px-3 py-3 bg-white min-h-[44px]"
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
              <div className="bg-white border rounded-xl p-4 active:bg-gray-50 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{s.name}</span>
                      {s.grade && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${GRADE_COLORS[s.grade] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.grade}
                        </span>
                      )}
                      {s.birth_date && <span className="text-xs text-gray-500">{age(s.birth_date)}</span>}
                      {s.status !== "active" && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 truncate">
                      {s.long_term_care_id && <span>{s.long_term_care_id} · </span>}
                      담당 {s.caregiver_names.length === 0 ? <span className="text-amber-600">미배정</span> : s.caregiver_names.join(", ")}
                      {s.last_journal_at && <span> · 최근 {fmtDate(s.last_journal_at)}</span>}
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
