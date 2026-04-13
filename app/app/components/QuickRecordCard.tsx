"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import RecordingDialog from "./RecordingDialog";

type Person = { id: number; name: string; grade?: string | null; phone?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  listUrl: string;
  listField: "recipients" | "caregivers";
  uploadUrl: string;
  uploadField: "senior_id" | "worker_id";
  accent: "indigo" | "emerald";
  onComplete?: () => void;
};

const ACCENT_CLASSES: Record<string, string> = {
  indigo: "active:bg-indigo-50",
  emerald: "active:bg-emerald-50",
};

export default function QuickRecordCard({
  open, onClose, title, listUrl, listField, uploadUrl, uploadField, accent, onComplete,
}: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(listUrl)
      .then((r) => r.json())
      .then((j) => setPeople(j[listField] ?? j.data ?? []));
  }, [open, listUrl, listField]);

  const filtered = q
    ? people.filter((p) => p.name.includes(q))
    : people;

  function close() {
    setSelected(null);
    setQ("");
    onClose();
  }

  if (!open) return null;

  // 녹음 단계
  if (selected) {
    return (
      <RecordingDialog
        open={true}
        onClose={() => setSelected(null)}
        title={`${selected.name} ${title}`}
        uploadUrl={uploadUrl}
        uploadField={uploadField}
        entityId={selected.id}
        onComplete={() => {
          onComplete?.();
          close();
        }}
      />
    );
  }

  // 검색/선택 단계
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{title} - 대상 선택</h2>
          <button onClick={close}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              autoFocus
              type="search"
              inputMode="search"
              placeholder="이름 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-3 border rounded-lg text-base"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {q ? "검색 결과 없음" : "불러오는 중..."}
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left px-3 py-3 rounded-lg ${ACCENT_CLASSES[accent] ?? ""}`}
              >
                <p className="font-medium">{p.name}</p>
                {(p.grade || p.phone) && (
                  <p className="text-xs text-gray-500">{p.grade ?? ""} {p.phone ?? ""}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
