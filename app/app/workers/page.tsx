"use client";

import { useState } from "react";
import useSWR from "swr";
import { useDebounce } from "@/lib/useDebounce";
import Link from "next/link";
import { Plus, Search, UserCheck, ChevronRight, Phone } from "lucide-react";

interface Caregiver {
  id: number;
  name: string;
  phone: string | null;
  birthDate: string | null;
  gender: "M" | "F" | null;
  licenseNumber: string | null;
  hireDate: string | null;
  status: "active" | "resigned";
  activeRecipientCount: number;
  lastCounselingDate: string | null;
}

export default function WorkersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const debouncedSearch = useDebounce(search, 300);
  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter) params.set("status", statusFilter);
  const { data, isLoading } = useSWR<{ caregivers: Caregiver[]; total: number }>(
    `/api/workers?${params.toString()}`,
    { keepPreviousData: true }
  );
  const caregivers = data?.caregivers ?? [];
  const total = data?.total ?? 0;
  const loading = isLoading;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">요양보호사 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {total}명</p>
        </div>
        <Link href="/workers/new">
          <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            요양보호사 등록
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
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="">전체 상태</option>
          <option value="active">재직 중</option>
          <option value="resigned">퇴사</option>
        </select>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : caregivers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 요양보호사가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {caregivers.map((c) => (
            <Link key={c.id} href={`/workers/${c.id}`}>
              <div className="bg-white border rounded-xl p-4 hover:shadow-md transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.name}</span>
                      {c.gender && <span className="text-xs text-gray-500">{c.gender === "M" ? "남" : "여"}</span>}
                      {c.status === "resigned" && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">퇴사</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 truncate">
                      {c.phone && <span className="inline-flex items-center gap-0.5"><Phone className="w-3 h-3" />{c.phone} · </span>}
                      담당 {c.activeRecipientCount}명
                      {c.lastCounselingDate && <span> · 상담 {c.lastCounselingDate}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}