"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Plus, FileText, Loader2, ChevronRight } from "lucide-react";
import NewMeetingDialog from "./NewMeetingDialog";
import PickerDialog, { DocPickerType } from "./PickerDialog";

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

const SENIOR_DOCS: DocPickerType[] = [
  { v: "needs_assessment", label: "욕구사정지", needSenior: true },
  { v: "care_plan", label: "급여제공계획서", needSenior: true },
  { v: "monthly_status", label: "상태기록지(월간)", needSenior: true, needMonth: true },
  { v: "service_record", label: "급여제공기록지", needSenior: true, needMonth: true },
  { v: "senior_handover", label: "수급자 인수인계서", needSenior: true },
];
const WORKER_DOCS: DocPickerType[] = [
  { v: "monthly_counseling", label: "상담일지 월간보고", needWorker: true, needMonth: true },
];
const MATCH_DOCS: DocPickerType[] = [
  { v: "service_contract", label: "서비스제공 계약서", needSenior: true },
  { v: "monthly_work_report", label: "월간 업무보고서", needWorker: true, needMonth: true },
];

type Meeting = {
  id: number; meeting_type: string; title: string | null; held_at: string;
  topic: string | null; attendee_worker_ids: number[]; status: string;
};

export default function DocumentsPage() {
  const [newOpen, setNewOpen] = useState(false);
  const [picker, setPicker] = useState<DocPickerType | null>(null);
  const { data, isLoading } = useSWR<{ meetings: Meeting[] }>("/api/meetings");
  const meetings = data?.meetings ?? [];

  const DocGrid = ({ items }: { items: DocPickerType[] }) => (
    <div className="grid grid-cols-2 gap-2">
      {items.map((d) => (
        <button
          key={d.v}
          onClick={() => setPicker(d)}
          className="min-h-[72px] bg-white border rounded-xl p-3 text-left active:bg-gray-50"
        >
          <FileText className="w-5 h-5 text-indigo-600 mb-1" />
          <p className="text-sm font-medium">{d.label}</p>
        </button>
      ))}
    </div>
  );

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">서류</h1>
        <p className="text-xs text-gray-500 mt-0.5">AI가 기존 데이터로 서류를 작성합니다</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">대상자 서류</p>
        <DocGrid items={SENIOR_DOCS} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">요양사 서류</p>
        <DocGrid items={WORKER_DOCS} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">대상자·요양사 합본</p>
        <DocGrid items={MATCH_DOCS} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600">회의록</p>
          <button
            onClick={() => setNewOpen(true)}
            className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg"
          >
            <Plus className="w-3 h-3" /> 새 회의록
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
      </div>

      <NewMeetingDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <PickerDialog docType={picker} onClose={() => setPicker(null)} />
    </div>
  );
}
