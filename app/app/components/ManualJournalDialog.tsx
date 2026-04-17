"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { X, Loader2, Search } from "lucide-react";
import { invalidate } from "@/lib/swr";

export default function ManualJournalDialog({
  open,
  onClose,
  presetSeniorId,
  presetSeniorName,
}: {
  open: boolean;
  onClose: () => void;
  presetSeniorId?: number;
  presetSeniorName?: string;
}) {
  const needSeniorList = open && !presetSeniorId;
  const { data: seniorsRes } = useSWR<{ data: any[] }>(needSeniorList ? "/api/seniors?status=active" : null);
  const seniors = seniorsRes?.data ?? [];

  const [seniorId, setSeniorId] = useState<number | null>(null);
  const [seniorName, setSeniorName] = useState<string>("");
  const [seniorGrade, setSeniorGrade] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (presetSeniorId) {
        setSeniorId(presetSeniorId);
        setSeniorName(presetSeniorName ?? "");
        setSeniorGrade(null);
      } else {
        setSeniorId(null);
        setSeniorName("");
        setSeniorGrade(null);
      }
      setSearch(""); setContent(""); setErr(null);
      setDate(new Date().toISOString().slice(0, 10));
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open, presetSeniorId, presetSeniorName]);

  if (!open) return null;

  const filtered = search ? seniors.filter((s) => s.name.includes(search)) : seniors;
  const showPicker = !presetSeniorId && !seniorId;

  const save = async () => {
    if (!seniorId) { setErr("대상자를 선택해주세요"); return; }
    if (!content.trim()) { setErr("내용을 입력해주세요"); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/journals/manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senior_id: seniorId, content, date }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "저장 실패");
      invalidate("/api/journals", "/api/seniors", `/api/seniors/${seniorId}`);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">대상자 일지 수기 작성</h3>
          <button onClick={onClose} className="p-2 active:bg-gray-100 rounded-lg" disabled={saving}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showPicker ? (
            <div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="search"
                  inputMode="search"
                  placeholder="대상자 이름 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border rounded-lg text-base"
                />
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSeniorId(s.id); setSeniorName(s.name); setSeniorGrade(s.grade ?? null); }}
                    className="w-full text-left px-3 py-3 border-b active:bg-gray-100 flex items-center justify-between"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-gray-500">{s.grade ?? ""}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">결과 없음</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <span className="font-medium">{seniorName}{seniorGrade ? <span className="text-xs text-gray-500"> · {seniorGrade}</span> : null}</span>
                {!presetSeniorId && (
                  <button onClick={() => { setSeniorId(null); setSeniorName(""); setSeniorGrade(null); }} className="text-xs text-indigo-600">변경</button>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">일자</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg px-3 py-3 text-base mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">일지 내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="어르신 상태, 제공한 서비스, 특이사항 등"
                  rows={10}
                  className="w-full border rounded-lg px-3 py-3 text-base mt-1 resize-y"
                />
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
            </>
          )}
        </div>
        <div className="p-4 border-t">
          <button
            onClick={save}
            disabled={saving || !seniorId || !content.trim()}
            className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</> : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
