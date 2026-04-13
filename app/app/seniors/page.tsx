"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, User, ChevronRight } from "lucide-react";

interface Recipient {
  id: number;
  name: string;
  birthDate: string;
  gender: "M" | "F";
  careGrade: number;
  status: "active" | "ended" | "suspended";
  guardianName: string | null;
  guardianPhone: string | null;
  activeAssignmentCount: number;
  lastJournalDate: string | null;
}

const CARE_GRADE_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-yellow-100 text-yellow-700",
  4: "bg-green-100 text-green-700",
  5: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  ended: "종료",
  suspended: "일시중단",
};

export default function SeniorsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/seniors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error("대상자 목록 로딩 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchRecipients, 300);
    return () => clearTimeout(debounce);
  }, [fetchRecipients]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수급자 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total}명</p>
        </div>
        <Link href="/seniors/new">
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            어르신 등록
          </button>
        </Link>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="ended">종료</option>
          <option value="suspended">일시중단</option>
        </select>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : recipients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 어르신이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipients.map((r) => (
            <Link key={r.id} href={`/seniors/${r.id}`}>
              <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {r.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{r.name}</span>
                        <span className="text-xs text-gray-500">{r.gender === "M" ? "남" : "여"}</span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${CARE_GRADE_COLORS[r.careGrade] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {r.careGrade}등급
                        </span>
                        {r.status !== "active" && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {STATUS_LABELS[r.status]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>담당 요양보호사 {r.activeAssignmentCount}명</span>
                        {r.lastJournalDate && <span>최근 일지: {r.lastJournalDate}</span>}
                      </div>
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