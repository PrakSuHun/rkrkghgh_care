"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, RefreshCw, Trash2, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { invalidate } from "@/lib/swr";
import { CENTER_INFO } from "@/lib/centerInfo";

const ITEMS: Array<{ key: string; label: string; opts: Array<{ score: number; text: string }> }> = [
  { key: "age", label: "연령", opts: [{ score: 4, text: "" }, { score: 3, text: ">80" }, { score: 2, text: "70-79" }, { score: 1, text: "60-69" }] },
  { key: "mental", label: "정신상태", opts: [{ score: 4, text: "혼란스러움/\n방향감각장애" }, { score: 3, text: "" }, { score: 2, text: "때때로 혼란스러움/\n방향감각장애" }, { score: 1, text: "" }] },
  { key: "bowel", label: "배변", opts: [{ score: 4, text: "소변, 대변 실금" }, { score: 3, text: "조절능력 있지만\n도움필요" }, { score: 2, text: "" }, { score: 1, text: "유치도뇨관\n/인공항루" }] },
  { key: "fall_history", label: "낙상경험", opts: [{ score: 4, text: "이미 세 번 이상\n넘어짐" }, { score: 3, text: "" }, { score: 2, text: "이미 한 번 또는\n두 번 넘어짐" }, { score: 1, text: "" }] },
  { key: "activity", label: "활동", opts: [{ score: 4, text: "거의 누워 있음" }, { score: 3, text: "자리에서 일어나\n앉기 도움" }, { score: 2, text: "" }, { score: 1, text: "자립/세면대,\n화장실이용" }] },
  { key: "gait", label: "걸음걸이\n및 균형", opts: [{ score: 4, text: "불규칙/불안정, 서 있을\n때와 걸을 때 균형을\n거의 유지하지 못함" }, { score: 3, text: "일어서기/걸을 때\n기립성 빈혈/혈액\n순환문제" }, { score: 2, text: "보행장애/\n보조도구나\n도움으로 걷기" }, { score: 1, text: "" }] },
  { key: "medication", label: "지난7일간\n약복용이나\n계획된 약물", opts: [{ score: 4, text: "3개 또는 그 이상의\n약 복용" }, { score: 3, text: "두 가지 약 복용" }, { score: 2, text: "한 가지 약 복용" }, { score: 1, text: "" }] },
];

export default function FallAssessmentPage() {
  const { id, fid } = useParams() as { id: string; fid: string };
  const router = useRouter();
  const sp = useSearchParams();
  const backUrl = sp.get("from") === "documents" ? "/documents" : `/seniors/${id}`;
  const backLabel = sp.get("from") === "documents" ? "서류 목록" : "대상자로";
  const { data, mutate, isLoading } = useSWR<any>(`/api/fall-assessments/${fid}`);
  const [regenerating, setRegenerating] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);

  if (isLoading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!data?.assessment) return <div className="p-6">평가지를 찾을 수 없습니다.</div>;
  const a = data.assessment;
  const name = a.seniors?.name ?? "-";
  const scores: Record<string, number> = a.scores ?? {};

  const updateScore = async (key: string, score: number) => {
    const next = { ...scores, [key]: score };
    await fetch(`/api/fall-assessments/${fid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: next }),
    });
    mutate();
    invalidate("/api/fall-assessments");
  };

  const saveNotes = async () => {
    if (notesDraft === null) return;
    setSavingNotes(true);
    await fetch(`/api/fall-assessments/${fid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    mutate();
    invalidate("/api/fall-assessments");
    setNotesDraft(null);
    setSavingNotes(false);
  };

  const regen = async () => {
    if (!confirm("AI로 다시 평가할까요? 기존 점수가 덮어써집니다.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/fall-assessments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senior_id: Number(id) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      invalidate("/api/fall-assessments");
      router.push(`/seniors/${id}/fall-assessment/${j.assessment.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  const del = async () => {
    if (!confirm("이 평가지를 삭제할까요?")) return;
    await fetch(`/api/fall-assessments/${fid}`, { method: "DELETE" });
    invalidate("/api/fall-assessments");
    router.push(`/seniors/${id}`);
  };

  const d = new Date(a.assessed_at);
  const dateStr = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;

  return (
    <>
      <div className="no-print px-4 py-3 max-w-3xl mx-auto flex items-center justify-between gap-2">
        <Link href={backUrl} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
        </Link>
        <div className="flex gap-2">
          <button onClick={regen} disabled={regenerating} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} /> 재평가
          </button>
          <button onClick={del} className="min-h-[40px] p-2 text-red-500 active:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
            <Printer className="w-4 h-4" /> 인쇄
          </button>
        </div>
      </div>

      <article className="print-sheet fall-sheet max-w-3xl mx-auto bg-white border p-6 sm:p-10 mb-4">
        <div className="mb-3">
          <p className="fall-title font-bold" style={{ fontSize: 12 }}>낙상예방(Huhn의 낙상위험도 평가도구)</p>
          <p className="text-right font-bold mt-4" style={{ fontSize: 11 }}>수급자 성명 : {name}</p>
        </div>

        <table className="nf-table score-table" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-center">구분</th>
              <th className="text-center">4점</th>
              <th className="text-center">3점</th>
              <th className="text-center">2점</th>
              <th className="text-center">1점</th>
              <th className="text-center">점수</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((it) => (
              <tr key={it.key}>
                <td className="text-center whitespace-pre-wrap font-medium" style={{ padding: "8px 4px" }}>{it.label}</td>
                {it.opts.map((opt) => (
                  <td
                    key={opt.score}
                    onClick={() => opt.text && updateScore(it.key, opt.score)}
                    className={`whitespace-pre-wrap ${opt.text ? "cursor-pointer" : ""} ${scores[it.key] === opt.score ? "bg-yellow-200" : ""}`}
                    style={{ padding: "6px 4px", minHeight: 50 }}
                  >
                    {opt.text}
                  </td>
                ))}
                <td
                  onClick={() => updateScore(it.key, 0)}
                  className={`text-center font-bold cursor-pointer ${scores[it.key] === 0 ? "bg-yellow-200" : ""}`}
                  style={{ padding: "6px 4px" }}
                >
                  {scores[it.key] ?? 0}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="text-center font-medium" style={{ padding: "4px" }}>합계점수</td>
              <td className="text-center font-bold" style={{ padding: "4px" }}>{a.total}</td>
            </tr>
          </tbody>
        </table>

        <table className="nf-table mt-0" style={{ borderTop: 0 }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 8px" }}>
                <p>※ 척도(합계점수 해석)</p>
                <p>&nbsp;&nbsp;· 4점 이하 : 낙상위험 낮음</p>
                <p>&nbsp;&nbsp;· 5-10점 : 낙상위험 높음 &nbsp;&nbsp; · <strong>11점 이상 : 낙상위험 아주 높음</strong></p>
                {a.interpretation && <p className="mt-1 font-bold text-indigo-700 no-print">→ 현재: {a.interpretation}</p>}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px" }}>
                <textarea
                  className="nf-edit-text"
                  rows={3}
                  value={notesDraft ?? a.notes ?? ""}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="특이사항 입력"
                />
                {savingNotes && <p className="text-xs text-gray-400">저장 중...</p>}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="fall-footer mt-8 text-center">
          <p>{dateStr}</p>
          <p className="mt-3">작성자 : {a.assessor ?? CENTER_INFO.head} &nbsp; (서명)</p>
        </div>
      </article>

      <div className="no-print max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-white border rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> AI로 수정 — 점수나 특이사항을 자연어로 변경
          </p>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="예: 낙상경험을 3번 이상으로 변경해줘 / 특이사항에 보행기 사용 내용 추가"
            rows={2}
            className="w-full border rounded-lg p-2 text-sm"
          />
          <button
            onClick={async () => {
              if (!chatInput.trim()) return;
              setRefining(true);
              try {
                const res = await fetch(`/api/fall-assessments/${fid}/refine`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ instruction: chatInput }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error);
                mutate();
                invalidate("/api/fall-assessments");
                setChatInput("");
              } catch (e: any) {
                alert(e.message);
              } finally {
                setRefining(false);
              }
            }}
            disabled={refining || !chatInput.trim()}
            className="w-full min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {refining ? <><Loader2 className="w-4 h-4 animate-spin" /> 적용 중...</> : "적용"}
          </button>
        </div>
      </div>
    </>
  );
}
