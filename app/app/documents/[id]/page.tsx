"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { invalidate } from "@/lib/swr";

const TYPE_LABEL: Record<string, string> = {
  monthly_staff: "월례 직원회의",
  case_conference: "사례회의",
  safety_edu: "안전교육",
  infection_edu: "감염관리 교육",
  dementia_edu: "치매관리 교육",
  human_rights_edu: "노인인권 교육",
  harassment_edu: "성희롱예방 교육",
  handover: "인수인계 회의",
};

export default function MeetingDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data } = useSWR<any>(`/api/meetings/${id}`);
  const [copied, setCopied] = useState(false);

  if (!data) return <div className="p-6">로딩 중...</div>;
  const m = data.meeting;
  const attendees = (data.attendees ?? []).map((a: any) => a.name).join(", ");
  const senior = data.senior;

  const fullText = () => {
    return [
      `${TYPE_LABEL[m.meeting_type] ?? m.meeting_type}`,
      ``,
      `일시: ${m.held_at}${m.held_time ? " " + m.held_time : ""}`,
      `장소: ${m.location ?? "센터 사무실"}`,
      `참석자: ${attendees || "없음"}`,
      senior ? `대상 어르신: ${senior.name}` : "",
      m.topic ? `주제: ${m.topic}` : "",
      ``,
      `[안건]`,
      m.agenda ?? "",
      ``,
      `[논의내용]`,
      m.content ?? "",
      ``,
      `[결정사항]`,
      m.decisions ?? "",
    ].filter(Boolean).join("\n");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(fullText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const del = async () => {
    if (!confirm("이 회의록을 삭제할까요?")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    invalidate("/api/meetings");
    router.push("/documents");
  };

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/documents" className="inline-flex items-center text-sm text-gray-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
      </Link>

      <section className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{TYPE_LABEL[m.meeting_type] ?? m.meeting_type}</h1>
            <p className="text-xs text-gray-500">{m.held_at} · 참석 {attendees || "없음"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={copy} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
              {copied ? <><Check className="w-4 h-4" /> 복사됨</> : <><Copy className="w-4 h-4" /> 전체 복사</>}
            </button>
            <button onClick={del} className="min-h-[40px] p-2 text-red-500 active:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-sm space-y-1 border-t pt-3">
          <p><span className="text-gray-500">장소:</span> {m.location ?? "센터 사무실"}</p>
          {senior && <p><span className="text-gray-500">대상 어르신:</span> {senior.name} ({senior.grade ?? "등급-"})</p>}
          {m.topic && <p><span className="text-gray-500">주제:</span> {m.topic}</p>}
        </div>
      </section>

      <Section label="안건" value={m.agenda} />
      <Section label="논의내용" value={m.content} />
      <Section label="결정사항" value={m.decisions} />
    </div>
  );
}

function Section({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <section className="bg-white border rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-700 mb-2">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-gray-800">{value}</p>
    </section>
  );
}
