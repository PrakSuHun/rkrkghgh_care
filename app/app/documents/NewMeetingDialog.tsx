"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { invalidate } from "@/lib/swr";

const TYPES = [
  { v: "monthly_staff", label: "월례 직원회의" },
  { v: "case_conference", label: "사례회의", needSenior: true },
  { v: "safety_edu", label: "안전교육", needTopic: true },
  { v: "infection_edu", label: "감염관리 교육" },
  { v: "dementia_edu", label: "치매관리 교육" },
  { v: "human_rights_edu", label: "노인인권 교육" },
  { v: "harassment_edu", label: "성희롱예방 교육" },
  { v: "handover", label: "인수인계 회의", needSenior: true, needHandoverWorkers: true },
];

export default function NewMeetingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data: workersRes } = useSWR<{ caregivers: any[] }>(open ? "/api/workers?status=active" : null);
  const { data: seniorsRes } = useSWR<{ data: any[] }>(open ? "/api/seniors?status=active" : null);

  const [type, setType] = useState<string>("monthly_staff");
  const [heldAt, setHeldAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<Set<number>>(new Set());
  const [seniorId, setSeniorId] = useState<number | null>(null);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;
  const meta = TYPES.find((t) => t.v === type)!;
  const workers = workersRes?.caregivers ?? [];
  const seniors = seniorsRes?.data ?? [];

  const toggle = (id: number) => {
    const next = new Set(attendeeIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAttendeeIds(next);
  };
  const selectAll = () => setAttendeeIds(new Set(workers.map((w: any) => w.id)));
  const clearAll = () => setAttendeeIds(new Set());

  const submit = async () => {
    if (meta.needSenior && !seniorId) { setErr("대상 어르신을 선택해주세요"); return; }
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_type: type, held_at: heldAt,
          attendee_worker_ids: Array.from(attendeeIds),
          related_senior_id: seniorId,
          related_from_worker_id: fromId,
          related_to_worker_id: toId,
          topic: topic || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "작성 실패");
      invalidate("/api/meetings");
      onClose();
      router.push(`/documents/meeting/${j.meeting.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">회의록 작성</h3>
          <button onClick={onClose} className="p-2 active:bg-gray-100 rounded-lg" disabled={loading}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500">유형</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">개최일</label>
            <input type="date" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
          </div>

          {meta.needTopic && (
            <div>
              <label className="text-xs text-gray-500">교육 주제</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 낙상예방 및 응급처치" className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
            </div>
          )}

          {meta.needSenior && (
            <div>
              <label className="text-xs text-gray-500">대상 어르신</label>
              <select value={seniorId ?? ""} onChange={(e) => setSeniorId(e.target.value ? Number(e.target.value) : null)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
                <option value="">선택</option>
                {seniors.map((s: any) => <option key={s.id} value={s.id}>{s.name} · {s.grade ?? "등급-"}</option>)}
              </select>
            </div>
          )}

          {meta.needHandoverWorkers && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">전임</label>
                <select value={fromId ?? ""} onChange={(e) => setFromId(e.target.value ? Number(e.target.value) : null)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
                  <option value="">선택</option>
                  {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">후임</label>
                <select value={toId ?? ""} onChange={(e) => setToId(e.target.value ? Number(e.target.value) : null)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
                  <option value="">선택</option>
                  {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">참석자 ({attendeeIds.size}명)</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs px-2 py-1 bg-gray-100 active:bg-gray-300 rounded">전체</button>
                <button onClick={clearAll} className="text-xs px-2 py-1 bg-gray-100 active:bg-gray-300 rounded">해제</button>
              </div>
            </div>
            <div className="border rounded-lg p-2 max-h-60 overflow-y-auto grid grid-cols-2 gap-1">
              {workers.map((w: any) => {
                const on = attendeeIds.has(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    className={`min-h-[40px] text-sm rounded-lg px-2 ${on ? "bg-indigo-600 text-white" : "bg-gray-50 active:bg-gray-200"}`}
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <div className="p-4 border-t">
          <button
            onClick={submit}
            disabled={loading}
            className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> AI가 작성 중...</> : "AI로 회의록 작성"}
          </button>
        </div>
      </div>
    </div>
  );
}
