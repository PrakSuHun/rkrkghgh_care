"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";

const SECTIONS = [
  { key: "assess_meal", label: "01. 식사 및 영양상태" },
  { key: "assess_mobility", label: "02. 보행" },
  { key: "assess_physical", label: "03. 신체기능" },
  { key: "assess_excretion", label: "04. 배뇨, 배변기능" },
  { key: "assess_hygiene", label: "05. 위생 관리" },
  { key: "assess_adl", label: "06. 일상생활수행 (ADL)" },
  { key: "assess_cognition", label: "07. 인지기능" },
  { key: "assess_behavior", label: "08. 행동증상" },
  { key: "assess_family_env", label: "09. 가족 및 생활환경" },
  { key: "assess_summary", label: "10. 기타 및 종합의견" },
];

export default function SeniorSummaryCard({ senior, onUpdated }: { senior: Record<string, any>; onUpdated?: (s: Record<string, any>) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [regen, setRegen] = useState(false);

  async function regenerate() {
    if (!confirm("최근 3주 일지를 기반으로 요약을 갱신할까요? (기존 내용은 약간만 변경됩니다)")) return;
    setRegen(true);
    try {
      const res = await fetch(`/api/seniors/${senior.id}/regenerate-summary`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "실패");
      // 갱신된 데이터 다시 fetch
      const fresh = await fetch(`/api/seniors`).then((r) => r.json());
      const updated = (fresh.data ?? []).find((s: any) => s.id === senior.id);
      if (updated) onUpdated?.(updated);
      alert(`갱신 완료 (일지 ${j.journals_used}건 반영, v${j.version})`);
    } catch (e: any) {
      alert(`실패: ${e.message}`);
    } finally {
      setRegen(false);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  function copyAll() {
    const all = SECTIONS
      .map((s) => `[${s.label}]\n${senior[s.key] ?? "-"}`)
      .join("\n\n");
    copy("all", all);
  }

  return (
    <div className="bg-white border rounded-2xl p-4 space-y-3">
      <div className="sticky top-14 bg-white pb-2 border-b z-10 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{senior.name}</h2>
            <p className="text-xs text-gray-500 truncate">
              {senior.grade ?? "등급-"} · {senior.long_term_care_id ?? ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={regenerate}
              disabled={regen}
              className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${regen ? "animate-spin" : ""}`} />
              {regen ? "갱신중" : "AI 갱신"}
            </button>
            <button
              onClick={copyAll}
              className="min-h-[40px] px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium active:bg-indigo-800"
            >
              {copied === "all" ? "✓ 전체 복사됨" : "전체 복사"}
            </button>
          </div>
        </div>
      </div>

      {SECTIONS.map((s) => {
        const value = senior[s.key];
        return (
          <div key={s.key} className="border rounded-xl p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-gray-700">{s.label}</p>
              <button
                onClick={() => value && copy(s.key, value)}
                disabled={!value}
                className="shrink-0 px-3 py-2 bg-gray-100 active:bg-indigo-100 rounded-lg text-xs disabled:opacity-40 inline-flex items-center gap-1"
              >
                {copied === s.key ? (
                  <><Check className="w-4 h-4 text-green-600" /> 복사됨</>
                ) : (
                  <><Copy className="w-4 h-4" /> 복사</>
                )}
              </button>
            </div>
            <p className="text-sm whitespace-pre-wrap text-gray-800">
              {value ?? <span className="text-gray-400">내용 없음</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
