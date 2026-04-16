"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { invalidate } from "@/lib/swr";
import { CENTER_INFO } from "@/lib/centerInfo";

const ITEMS: Array<{ key: string; label: string; options: Array<{ score: number; text: string }> }> = [
  { key: "age", label: "연령", options: [{ score: 4, text: "" }, { score: 3, text: ">80" }, { score: 2, text: "70-79" }, { score: 1, text: "60-69" }] },
  { key: "mental", label: "정신상태", options: [{ score: 4, text: "혼란스러움/\n방향감각장애" }, { score: 3, text: "" }, { score: 2, text: "때때로 혼란스러움/\n방향감각장애" }, { score: 1, text: "" }] },
  { key: "bowel", label: "배변", options: [{ score: 4, text: "소변, 대변 실금" }, { score: 3, text: "조절능력 있지만\n도움필요" }, { score: 2, text: "" }, { score: 1, text: "유치도뇨관\n/인공항루" }] },
  { key: "fall_history", label: "낙상경험", options: [{ score: 4, text: "이미 세 번 이상\n넘어짐" }, { score: 3, text: "" }, { score: 2, text: "이미 한 번 또는\n두 번 넘어짐" }, { score: 1, text: "" }] },
  { key: "activity", label: "활동", options: [{ score: 4, text: "거의 누워 있음" }, { score: 3, text: "자리에서 일어나\n앉기 도움" }, { score: 2, text: "" }, { score: 1, text: "자립/세면대,\n화장실이용" }] },
  { key: "gait", label: "걸음걸이\n및 균형", options: [{ score: 4, text: "불규칙/불안정, 서 있을\n때와 걸을 때 균형을\n거의 유지하지 못함" }, { score: 3, text: "일어서기/걸을 때\n기립성 빈혈/혈액\n순환문제" }, { score: 2, text: "보행장애/\n보조도구나\n도움으로 걷기" }, { score: 1, text: "" }] },
  { key: "medication", label: "지난7일간\n약복용이나\n계획된 약물", options: [{ score: 4, text: "3개 또는 그 이상의\n약 복용" }, { score: 3, text: "두 가지 약 복용" }, { score: 2, text: "한 가지 약 복용" }, { score: 1, text: "" }] },
];

export default function FallAssessmentPage() {
  const { id, fid } = useParams() as { id: string; fid: string };
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR<any>(`/api/fall-assessments/${fid}`);
  const [regenerating, setRegenerating] = useState(false);

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

  return (
    <>
      <div className="no-print px-4 py-3 max-w-3xl mx-auto flex items-center justify-between gap-2">
        <Link href={`/seniors/${id}`} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 대상자로
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

      <article className="print-sheet max-w-3xl mx-auto bg-white border p-6 sm:p-10 mb-4">
        <div className="mb-4">
          <h1 className="text-base font-bold">낙상예방(Huhn의 낙상위험도 평가도구)</h1>
          <p className="text-right font-bold text-sm mt-2">수급자 성명 : {name}</p>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-black p-1 bg-gray-100 w-20">구분</th>
              <th className="border border-black p-1 bg-gray-100">4점</th>
              <th className="border border-black p-1 bg-gray-100">3점</th>
              <th className="border border-black p-1 bg-gray-100">2점</th>
              <th className="border border-black p-1 bg-gray-100">1점</th>
              <th className="border border-black p-1 bg-gray-100 w-12">점수</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((it) => (
              <tr key={it.key}>
                <td className="border border-black p-1 text-center whitespace-pre-wrap font-medium">{it.label}</td>
                {it.options.map((opt) => (
                  <td
                    key={opt.score}
                    onClick={() => opt.text && updateScore(it.key, opt.score)}
                    className={`border border-black p-1 whitespace-pre-wrap align-top cursor-pointer ${scores[it.key] === opt.score ? "bg-yellow-200" : ""}`}
                  >
                    {opt.text}
                  </td>
                ))}
                <td
                  onClick={() => updateScore(it.key, 0)}
                  className={`border border-black p-1 text-center font-bold cursor-pointer ${scores[it.key] === 0 ? "bg-yellow-200" : ""}`}
                >
                  {scores[it.key] ?? 0}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="border border-black p-1 text-center font-bold bg-gray-50">합계점수</td>
              <td className="border border-black p-1 text-center font-bold">{a.total}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 text-xs border border-black p-2">
          <p>※ 척도(합계점수 해석)</p>
          <p> · 4점 이하 : 낙상위험 낮음</p>
          <p> · 5-10점 : 낙상위험 높음 · <strong>11점 이상 : 낙상위험 아주 높음</strong></p>
          <p className="mt-1 font-bold text-indigo-700">→ 현재: {a.interpretation}</p>
        </div>

        <div className="mt-2 border border-black p-2 text-xs whitespace-pre-wrap">
          {a.notes || "(특이사항 없음)"}
        </div>

        <div className="mt-6 text-center text-xs">
          <p>{new Date(a.assessed_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}</p>
          <p className="mt-2">작성자 : {a.assessor ?? CENTER_INFO.head} (서명)</p>
        </div>
      </article>
    </>
  );
}
