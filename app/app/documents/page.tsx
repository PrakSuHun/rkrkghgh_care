"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Plus, FileText, Loader2, ChevronRight } from "lucide-react";
import NewMeetingDialog from "./NewMeetingDialog";

const MEETING_TYPE_LABEL: Record<string, string> = {
  monthly_staff: "월례 직원회의",
  case_conference: "사례회의",
  safety_edu: "안전교육",
  infection_edu: "감염관리 교육",
  dementia_edu: "치매관리 교육",
  human_rights_edu: "노인인권 교육",
  harassment_edu: "성희롱예방 교육",
  handover: "인수인계 회의",
};

const SENIOR_DOCS = [
  { v: "needs_assessment", label: "욕구사정지" },
  { v: "care_plan", label: "장기요양급여 제공계획서" },
  { v: "monthly_status", label: "월간 상태기록지" },
  { v: "service_record", label: "급여제공기록지" },
  { v: "senior_handover", label: "수급자 인수인계서" },
  { v: "service_contract", label: "장기요양급여 이용계약서" },
];
const WORKER_DOCS = [
  { v: "monthly_counseling", label: "상담일지 월간보고" },
  { v: "monthly_work_report", label: "월간 업무보고서" },
];

type Meeting = {
  id: number; meeting_type: string; title: string | null; held_at: string;
  topic: string | null; attendee_worker_ids: number[]; status: string;
};

export default function DocumentsPage() {
  const [newOpen, setNewOpen] = useState(false);
  const { data, isLoading } = useSWR<{ meetings: Meeting[] }>("/api/meetings");
  const meetings = data?.meetings ?? [];

  const DocButton = ({ v, label }: { v: string; label: string }) => (
    <Link
      href={`/documents/${v}`}
      className="min-h-[96px] bg-white border rounded-xl p-4 flex flex-col gap-2 active:bg-gray-50"
    >
      <FileText className="w-6 h-6 text-indigo-600" />
      <p className="text-base font-semibold">{label}</p>
    </Link>
  );

  return (
    <div className="px-4 py-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">서류</h1>
        <p className="text-sm text-gray-500 mt-1">원하는 서류를 눌러 AI로 작성하세요</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">대상자 서류</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SENIOR_DOCS.map((d) => <DocButton key={d.v} {...d} />)}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">요양사 서류</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {WORKER_DOCS.map((d) => <DocButton key={d.v} {...d} />)}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">회의록</h2>
          <button
            onClick={() => setNewOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-1 text-sm px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" /> 새 회의록
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : meetings.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">작성된 회의록이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <Link key={m.id} href={`/documents/meeting/${m.id}`}>
                <div className="bg-white border rounded-xl p-3 active:bg-gray-50 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title || MEETING_TYPE_LABEL[m.meeting_type]}</p>
                    <p className="text-xs text-gray-500 truncate">{m.held_at} · 참석 {m.attendee_worker_ids?.length ?? 0}명</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <NewMeetingDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
