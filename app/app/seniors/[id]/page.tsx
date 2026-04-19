"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { invalidate } from "@/lib/swr";
import Link from "next/link";
import { ArrowLeft, Mic, FileText, Loader2, Trash2, Repeat, Plus, X, ClipboardList, Activity, FileCheck, MessageSquare, FileUp, PenLine } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";
import ManualJournalDialog from "../../components/ManualJournalDialog";

type Worker = { id: number; name: string; phone: string | null };

export default function SeniorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [chooseAddOpen, setChooseAddOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");

  const { data, mutate, isLoading } = useSWR<any>(`/api/seniors/${id}`, {
    refreshInterval: (d: any) => (d?.journals ?? []).some((j: any) => j.status === "processing") ? 3000 : 0,
  });
  const loading = isLoading;
  const load = () => {
    mutate();
    invalidate("/api/seniors", "/api/workers", "/api/assignments");
  };

  const openPicker = async (mode: "add" | any) => {
    if (mode === "add") setAddOpen(true);
    else setSwapFor(mode);
    setPickerSearch("");
    if (allWorkers.length === 0) {
      const r = await fetch("/api/workers?status=active");
      const j = await r.json();
      setAllWorkers((j.data ?? []).map((w: any) => ({ id: w.id, name: w.name, phone: w.phone })));
    }
  };

  const closePicker = () => { setSwapFor(null); setAddOpen(false); };

  const pickWorker = async (workerId: number) => {
    if (swapFor) {
      const res = await fetch(`/api/assignments/${swapFor.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caregiver_id: workerId }),
      });
      if (!res.ok) { alert("교체 실패"); return; }
    } else if (addOpen) {
      const res = await fetch(`/api/assignments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senior_id: Number(id), caregiver_id: workerId,
          role: "주담당", start_date: new Date().toISOString().slice(0, 10), status: "active",
        }),
      });
      if (!res.ok) { alert("추가 실패"); return; }
    }
    closePicker();
    load();
  };

  const unassign = async (assignmentId: number) => {
    if (!confirm("배정을 해제할까요?")) return;
    const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    if (!res.ok) { alert("해제 실패"); return; }
    load();
  };

  const toggleStatus = async () => {
    const cur = data?.senior?.status ?? "active";
    const next = cur === "active" ? "inactive" : "active";
    const msg = next === "active" ? "활성 상태로 전환할까요?" : "비활성 처리할까요? (담당 배정도 모두 종료됩니다)";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/seniors/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) { alert("상태 변경 실패"); return; }
    load();
  };

  const deleteJournal = async (journalId: number) => {
    if (!confirm("이 일지를 삭제할까요? (복구할 수 없습니다)")) return;
    const res = await fetch(`/api/journals/${journalId}`, { method: "DELETE" });
    if (!res.ok) { alert("삭제 실패"); return; }
    load();
  };

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!data?.senior) return <div className="p-6">어르신을 찾을 수 없습니다.</div>;

  const s = data.senior;
  const journals = data.journals ?? [];
  const assignments = (data.assignments ?? []).filter((a: any) => a.status === "active");
  const filtered = pickerSearch
    ? allWorkers.filter((w) => w.name.includes(pickerSearch))
    : allWorkers;

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/seniors" className="inline-flex items-center text-sm text-gray-600 active:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Link>

      <section className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{s.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {s.grade ?? "등급-"}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                {s.status === "active" ? "활성" : "비활성"}
              </span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={toggleStatus}
              className={`min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${s.status === "active" ? "bg-gray-100 active:bg-gray-300 text-gray-700" : "bg-green-600 text-white active:bg-green-800"}`}
            >
              {s.status === "active" ? "비활성" : "활성화"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">담당 요양보호사</p>
            <button
              onClick={() => openPicker("add")}
              className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg"
            >
              <Plus className="w-3 h-3" /> 추가
            </button>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-amber-600">배정된 요양보호사가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.caregivers?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{a.caregivers?.phone ?? ""}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openPicker(a)}
                      className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg"
                    >
                      <Repeat className="w-3 h-3" /> 교체
                    </button>
                    <button
                      onClick={() => unassign(a.id)}
                      className="min-h-[36px] inline-flex items-center gap-1 text-xs px-3 py-2 bg-red-50 text-red-600 active:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <DocumentsSection seniorId={Number(id)} intakePdfPath={s.intake_pdf_path} />


      <section className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold">돌봄 일지</h2>
            <span className="text-xs text-gray-500">총 {journals.length}건</span>
          </div>
          <button
            onClick={() => setChooseAddOpen(true)}
            className="min-h-[36px] inline-flex items-center gap-1 text-sm px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
        {journals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">아직 작성된 일지가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {journals.map((j: any) => (
              <div key={j.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2 gap-2">
                  <p className="text-xs text-gray-500 min-w-0 truncate">
                    {new Date(j.created_at).toLocaleString("ko-KR")} · {Math.floor(j.duration / 60)}분 {j.duration % 60}초
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {j.status === "processing" && <span className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="w-3 h-3 animate-spin" /> 변환중</span>}
                    {j.status === "done" && <span className="text-xs text-green-600">완료</span>}
                    {j.status === "failed" && <span className="text-xs text-red-600">실패</span>}
                    <button
                      onClick={() => deleteJournal(j.id)}
                      className="min-h-[32px] p-2 text-red-500 active:bg-red-50 rounded-lg"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {j.summary && (
                  <p className="text-sm whitespace-pre-wrap bg-indigo-50 p-3 rounded">{j.summary}</p>
                )}
                {j.transcript && (
                  <details className="text-sm mt-2">
                    <summary className="cursor-pointer text-xs text-gray-500">원본 텍스트 보기</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{j.transcript}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {(swapFor || addOpen) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{swapFor ? "요양보호사 교체" : "요양보호사 추가"}</h3>
              <button onClick={closePicker} className="p-2 active:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <input
              type="search"
              inputMode="search"
              placeholder="이름으로 검색"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full border rounded-lg px-3 py-3 text-base mb-3"
            />
            <div className="flex-1 overflow-y-auto space-y-1">
              {filtered.map((w) => (
                <button
                  key={w.id}
                  onClick={() => pickWorker(w.id)}
                  className="w-full text-left min-h-[48px] px-3 py-2 active:bg-gray-100 rounded-lg flex items-center justify-between"
                >
                  <span className="font-medium">{w.name}</span>
                  <span className="text-xs text-gray-500">{w.phone ?? ""}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">결과가 없습니다</p>
              )}
            </div>
          </div>
        </div>
      )}

      <RecordingDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title={`${s.name} 어르신 일지 녹음`}
        uploadUrl="/api/journals"
        uploadField="senior_id"
        entityId={s.id}
        onComplete={load}
      />

      <ManualJournalDialog
        open={manualOpen}
        onClose={() => { setManualOpen(false); load(); }}
        presetSeniorId={s.id}
        presetSeniorName={s.name}
      />

      {chooseAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setChooseAddOpen(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">일지 추가 방식</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setChooseAddOpen(false); setRecordOpen(true); }}
                className="bg-indigo-600 active:bg-indigo-800 text-white rounded-xl p-4 flex flex-col items-center gap-2"
              >
                <Mic className="w-6 h-6" />
                <p className="text-sm font-medium">녹음</p>
              </button>
              <button
                onClick={() => { setChooseAddOpen(false); setManualOpen(true); }}
                className="bg-emerald-600 active:bg-emerald-800 text-white rounded-xl p-4 flex flex-col items-center gap-2"
              >
                <PenLine className="w-6 h-6" />
                <p className="text-sm font-medium">수기 작성</p>
              </button>
            </div>
            <button onClick={() => setChooseAddOpen(false)} className="mt-3 w-full min-h-[40px] bg-gray-100 active:bg-gray-200 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsSection({ seniorId, intakePdfPath }: { seniorId: number; intakePdfPath: string | null | undefined }) {
  const { data: fallRes } = useSWR<any>(`/api/fall-assessments?senior_id=${seniorId}`);
  const falls = fallRes?.assessments ?? [];
  const { data: intakeRes } = useSWR<any>(`/api/intake-forms?senior_id=${seniorId}`);
  const hasIntake = !!intakeRes?.intakes?.[0];
  const [intakeUrl, setIntakeUrl] = useState<string | null>(null);

  const openIntakePdf = async () => {
    if (!intakePdfPath) return;
    if (intakeUrl) { window.open(intakeUrl, "_blank"); return; }
    const r = await fetch(`/api/intake-download?path=${encodeURIComponent(intakePdfPath)}`);
    const j = await r.json();
    if (j.url) {
      setIntakeUrl(j.url);
      window.open(j.url, "_blank");
    }
  };

  const IntakeButton = hasIntake ? (
    <Link href={`/seniors/${seniorId}/intake-form`}>
      <div className="min-h-[64px] border rounded-lg p-3 active:bg-gray-50 flex flex-col gap-1">
        <FileUp className="w-4 h-4 text-indigo-600" />
        <p className="text-sm font-medium">초기상담기록지</p>
        <p className="text-xs text-gray-400">보기 / 편집</p>
      </div>
    </Link>
  ) : (
    <button
      onClick={openIntakePdf}
      disabled={!intakePdfPath}
      className="min-h-[64px] border rounded-lg p-3 text-left active:bg-gray-50 disabled:opacity-40 flex flex-col gap-1"
    >
      <FileUp className="w-4 h-4 text-gray-600" />
      <p className="text-sm font-medium">초기상담기록지</p>
      <p className="text-xs text-gray-400">{intakePdfPath ? "PDF 보기" : "업로드 없음"}</p>
    </button>
  );

  return (
    <section className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-600" />
        <h2 className="text-base font-semibold">서류</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {IntakeButton}

        <Link href={`/seniors/${seniorId}/needs-assessment`}>
          <div className="min-h-[64px] border rounded-lg p-3 active:bg-gray-50 flex flex-col gap-1">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-medium">욕구사정지</p>
            <p className="text-xs text-gray-400">공단 5페이지 서식</p>
          </div>
        </Link>

        <Link href={`/seniors/${seniorId}/handover`}>
          <div className="min-h-[64px] border rounded-lg p-3 active:bg-gray-50 flex flex-col gap-1">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-medium">인수인계서</p>
            <p className="text-xs text-gray-400">업무 인계·인수 확인서</p>
          </div>
        </Link>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 inline-flex items-center gap-1 mb-1"><Activity className="w-3 h-3" /> 낙상평가지</p>
        {falls.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">평가지 없음 — 대상자 등록 시 자동 생성됨</p>
        ) : (
          <div className="space-y-1">
            {falls.slice(0, 3).map((f: any) => (
              <Link key={f.id} href={`/seniors/${seniorId}/fall-assessment/${f.id}`}>
                <div className="border rounded-lg p-2 active:bg-gray-50 flex items-center justify-between gap-2">
                  <span className="text-xs truncate">{f.assessed_at} · 합계 {f.total}점</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${f.total <= 4 ? "bg-green-100 text-green-700" : f.total <= 10 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{f.interpretation}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}
