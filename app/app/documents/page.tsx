"use client";

import useSWR from "swr";
import Link from "next/link";
import { FileText, Loader2, Trash2, MessageSquare } from "lucide-react";
import { invalidate } from "@/lib/swr";

const SENIOR_DOCS = [
  { v: "needs_assessment", label: "욕구사정지" },
  { v: "senior_handover", label: "수급자 인수인계서" },
];
const WORKER_DOCS = [
  { v: "counseling", label: "요양보호사 상담일지", icon: "msg" },
  { v: "monthly_work_report", label: "업무체계보고서" },
];

const DOC_TYPE_LABEL: Record<string, string> = {
  needs_assessment: "욕구사정지",
  fall_assessment: "낙상평가지",
  senior_handover: "인수인계서",
  monthly_work_report: "업무체계보고서",
  counseling: "상담일지",
};

type SavedDoc = {
  id: number; doc_type: string; title: string; senior_id: number | null;
  worker_id: number | null; month: string | null; created_at: string;
  content?: any;
  seniors?: { name: string } | null; caregivers?: { name: string } | null;
};

export default function DocumentsPage() {
  const { data: docsRes, isLoading: docsLoading } = useSWR<{ documents: SavedDoc[] }>("/api/saved-documents");
  const docs = docsRes?.documents ?? [];

  const deleteDoc = async (id: number) => {
    if (!confirm("이 서류를 삭제할까요?")) return;
    await fetch(`/api/saved-documents/${id}`, { method: "DELETE" });
    invalidate("/api/saved-documents");
  };

  const docLink = (d: SavedDoc) => {
    if (d.doc_type === "needs_assessment" && d.senior_id) return `/seniors/${d.senior_id}/needs-assessment?from=documents`;
    if (d.doc_type === "fall_assessment" && d.senior_id && d.content) return `/seniors/${d.senior_id}/fall-assessment/${d.content?.fall_id ?? ""}?from=documents`;
    if (d.doc_type === "senior_handover" && d.senior_id) return `/seniors/${d.senior_id}/handover?from=documents`;
    return `/documents/view/${d.id}`;
  };

  return (
    <div className="px-4 py-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">서류</h1>
        <p className="text-sm text-gray-500 mt-1">AI로 서류를 작성하세요</p>
      </div>

      <section>
        <p className="text-xs font-semibold text-gray-500 mb-2">대상자 서류</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <Link href="/documents/needs_assessment" className="bg-white border rounded-xl p-3 sm:p-4 active:bg-gray-50 flex items-center gap-2 sm:gap-3 min-h-[56px]">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-sm font-semibold leading-tight">욕구사정지</p>
          </Link>
          <Link href="/documents/fall_assessment" className="bg-white border rounded-xl p-3 sm:p-4 active:bg-gray-50 flex items-center gap-2 sm:gap-3 min-h-[56px]">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-sm font-semibold leading-tight">낙상평가지</p>
          </Link>
          <Link href="/documents/senior_handover" className="bg-white border rounded-xl p-3 sm:p-4 active:bg-gray-50 flex items-center gap-2 sm:gap-3 min-h-[56px]">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-sm font-semibold leading-tight">인수인계서</p>
          </Link>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-gray-500 mb-2">요양사 관리</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Link href="/documents/counseling" className="bg-white border rounded-xl p-3 sm:p-4 active:bg-gray-50 flex items-center gap-2 sm:gap-3 min-h-[56px]">
            <MessageSquare className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold leading-tight">요양사 상담일지</p>
          </Link>
          <Link href="/documents/monthly_work_report" className="bg-white border rounded-xl p-3 sm:p-4 active:bg-gray-50 flex items-center gap-2 sm:gap-3 min-h-[56px]">
            <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold leading-tight">업무체계보고서</p>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">저장된 서류</h2>
        {docsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : docs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">저장된 서류가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <Link key={d.id} href={docLink(d)}>
                <div className="bg-white border rounded-xl p-3 flex items-start gap-3 active:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      <span className="text-xs text-indigo-600 mr-1">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</span>
                      {d.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {new Date(d.created_at).toLocaleDateString("ko-KR")}
                      {d.seniors?.name && ` · ${d.seniors.name}`}
                      {d.caregivers?.name && ` · ${d.caregivers.name}`}
                    </p>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteDoc(d.id); }} className="p-2 text-red-500 active:bg-red-50 rounded-lg shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
