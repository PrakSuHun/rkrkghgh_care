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

type Meeting = {
  id: number;
  meeting_type: string;
  title: string | null;
  held_at: string;
  topic: string | null;
  attendee_worker_ids: number[];
  status: string;
};

export default function DocumentsPage() {
  const [newOpen, setNewOpen] = useState(false);
  const { data, isLoading } = useSWR<{ meetings: Meeting[] }>("/api/meetings");
  const meetings = data?.meetings ?? [];

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">서류</h1>
          <p className="text-xs text-gray-500 mt-0.5">회의록 · AI 자동 작성</p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="min-h-[44px] flex items-center gap-2 bg-indigo-600 active:bg-indigo-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> 회의록 작성
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">작성된 회의록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <Link key={m.id} href={`/documents/${m.id}`}>
              <div className="bg-white border rounded-xl p-4 active:bg-gray-50 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{m.title || MEETING_TYPE_LABEL[m.meeting_type] || m.meeting_type}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {m.held_at} · {MEETING_TYPE_LABEL[m.meeting_type] ?? m.meeting_type} · 참석 {m.attendee_worker_ids?.length ?? 0}명
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewMeetingDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
