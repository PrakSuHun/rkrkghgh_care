"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export type DocPickerType = {
  v: string;
  label: string;
  needSenior?: boolean;
  needWorker?: boolean;
  needMonth?: boolean;
};

export default function PickerDialog({ docType, onClose }: { docType: DocPickerType | null; onClose: () => void }) {
  const router = useRouter();
  const open = !!docType;
  const { data: seniorsRes } = useSWR<{ data: any[] }>(open && docType?.needSenior ? "/api/seniors?status=active" : null);
  const { data: workersRes } = useSWR<{ caregivers: any[] }>(open && docType?.needWorker ? "/api/workers?status=active" : null);

  const [seniorId, setSeniorId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (open) {
      setSeniorId(""); setWorkerId("");
      setMonth(new Date().toISOString().slice(0, 7));
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open || !docType) return null;

  const go = () => {
    const p = new URLSearchParams({ type: docType.v });
    if (docType.needSenior) { if (!seniorId) return alert("어르신을 선택해주세요"); p.set("seniorId", seniorId); }
    if (docType.needWorker) { if (!workerId) return alert("요양사를 선택해주세요"); p.set("workerId", workerId); }
    if (docType.needMonth) { if (!month) return alert("년월을 선택해주세요"); p.set("month", month); }
    onClose();
    router.push(`/documents/preview?${p.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{docType.label}</h3>
          <button onClick={onClose} className="p-2 active:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {docType.needSenior && (
            <div>
              <label className="text-xs text-gray-500">어르신</label>
              <select value={seniorId} onChange={(e) => setSeniorId(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
                <option value="">선택</option>
                {(seniorsRes?.data ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.grade ?? "등급-"}</option>
                ))}
              </select>
            </div>
          )}
          {docType.needWorker && (
            <div>
              <label className="text-xs text-gray-500">요양보호사</label>
              <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1">
                <option value="">선택</option>
                {(workersRes?.caregivers ?? []).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          {docType.needMonth && (
            <div>
              <label className="text-xs text-gray-500">년월</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
            </div>
          )}
        </div>
        <div className="p-4 border-t">
          <button onClick={go} className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium">
            서류 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
