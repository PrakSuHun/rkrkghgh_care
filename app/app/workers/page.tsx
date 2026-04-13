"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);

  const fetchCaregivers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/workers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCaregivers(data.caregivers ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error("요양보호사 목록 로딩 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchCaregivers, 300);
    return () => clearTimeout(debounce);
  }, [fetchCaregivers]);

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
              <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        {c.gender && (
                          <span className="text-xs text-gray-500">{c.gender === "M" ? "남" : "여"}</span>
                        )}
                        {c.status === "resigned" && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">퇴사</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c.phone}
                          </span>
                        )}
                        <span>담당 어르신 {c.activeRecipientCount}명</span>
                        {c.lastCounselingDate && <span>최근 상담: {c.lastCounselingDate}</span>}
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