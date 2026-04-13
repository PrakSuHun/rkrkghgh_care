"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MessageSquare, Loader2, Pencil, Save, X } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";

export default function WorkerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/workers/${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setForm(json.worker);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function save() {
    const { fixed_weekly_schedules: _f, ...patch } = form;
    const res = await fetch(`/api/workers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setEditing(false);
      load();
    } else alert("저장 실패");
  }

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!data?.worker) return <div className="p-6">요양보호사를 찾을 수 없습니다.</div>;

  const w = data.worker;
  const logs = data.logs ?? [];
  const assignments = data.assignments ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/workers" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
      </Link>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{w.name}</h1>
            <p className="text-sm text-gray-500 mt-1">종사자 #{w.id} · {w.job_type ?? "요양보호사"}</p>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="inline-flex items-center px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"><Pencil className="w-4 h-4 mr-1" /> 편집</button>
                <button onClick={() => setRecordOpen(true)} className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg"><Mic className="w-4 h-4 mr-2" /> 상담 녹음</button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setForm(w); }} className="inline-flex items-center px-3 py-2 border rounded-lg text-sm"><X className="w-4 h-4 mr-1" /> 취소</button>
                <button onClick={save} className="inline-flex items-center px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Save className="w-4 h-4 mr-1" /> 저장</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
          <Field label="연락처" value={w.phone} editing={editing} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="직종" value={w.job_type} editing={editing} onChange={(v) => setForm({ ...form, job_type: v })} />
          <Field label="자격증 번호" value={w.license_number} editing={editing} onChange={(v) => setForm({ ...form, license_number: v })} />
          <Field label="자격증 등급" value={w.license_grade} editing={editing} onChange={(v) => setForm({ ...form, license_grade: v })} />
          <Field label="자격증 발급일" value={w.license_issued_at} editing={editing} type="date" onChange={(v) => setForm({ ...form, license_issued_at: v })} />
          <Field label="자격증 발급기관" value={w.license_issuer} editing={editing} onChange={(v) => setForm({ ...form, license_issuer: v })} />
          <Field label="입사일" value={w.hire_date} editing={editing} type="date" onChange={(v) => setForm({ ...form, hire_date: v })} />
          <Field label="퇴사일" value={w.terminated_at} editing={editing} type="date" onChange={(v) => setForm({ ...form, terminated_at: v })} />
          <Field label="근무형태" value={w.employment_type} editing={editing} onChange={(v) => setForm({ ...form, employment_type: v })} />
          <Field label="주당 근무시간" value={w.weekly_hours} editing={editing} onChange={(v) => setForm({ ...form, weekly_hours: v ? Number(v) : null })} />
          <Field label="임금 유형" value={w.wage_type} editing={editing} onChange={(v) => setForm({ ...form, wage_type: v })} />
          <Field label="임금" value={w.wage_amount} editing={editing} onChange={(v) => setForm({ ...form, wage_amount: v ? Number(v) : null })} />
          <Field label="계약 시작" value={w.contract_start} editing={editing} type="date" onChange={(v) => setForm({ ...form, contract_start: v })} />
          <Field label="계약 종료" value={w.contract_end} editing={editing} type="date" onChange={(v) => setForm({ ...form, contract_end: v })} />
          <Field label="주소" value={w.address} editing={editing} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="은행" value={w.bank_name} editing={editing} onChange={(v) => setForm({ ...form, bank_name: v })} />
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">4대보험</p>
          <div className="flex gap-4 text-sm">
            {["insurance_nhis", "insurance_pension", "insurance_employment", "insurance_workers_comp"].map((k) => (
              <label key={k} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  disabled={!editing}
                  checked={!!form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                />
                {k === "insurance_nhis" ? "건강" : k === "insurance_pension" ? "국민연금" : k === "insurance_employment" ? "고용" : "산재"}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* 담당 어르신 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">담당 어르신</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">배정된 어르신이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">{a.seniors?.name} <span className="text-xs text-gray-500">({a.role})</span></p>
                  <p className="text-xs text-gray-500">{a.seniors?.grade} · {a.start_date} ~ {a.end_date ?? "진행중"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${a.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 상담 일지 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">상담 일지</h2>
          </div>
          <span className="text-sm text-gray-500">총 {logs.length}건</span>
        </div>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">상담일지가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {logs.map((l: any) => (
              <div key={l.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">
                    {new Date(l.created_at).toLocaleString("ko-KR")} · {Math.floor(l.duration / 60)}분 {l.duration % 60}초
                  </p>
                  {l.status === "processing" && <span className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="w-3 h-3 animate-spin" /> 변환 중</span>}
                  {l.status === "done" && <span className="text-xs text-green-600">완료</span>}
                  {l.status === "failed" && <span className="text-xs text-red-600">실패</span>}
                </div>
                {l.summary && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">📋 AI 상담 요약</p>
                    <p className="text-sm whitespace-pre-wrap bg-emerald-50 p-3 rounded">{l.summary}</p>
                  </div>
                )}
                {l.transcript && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-gray-500">원본 텍스트 보기</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{l.transcript}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <RecordingDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title={`${w.name} 상담 녹음`}
        uploadUrl="/api/counseling"
        uploadField="worker_id"
        entityId={w.id}
        onComplete={load}
      />
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text" }: {
  label: string;
  value: any;
  editing: boolean;
  onChange: (v: any) => void;
  type?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      {editing ? (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
      ) : (
        <p className="font-medium text-sm">{value ?? "-"}</p>
      )}
    </div>
  );
}
