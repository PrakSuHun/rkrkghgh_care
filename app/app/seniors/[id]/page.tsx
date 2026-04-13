"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, FileText, Loader2, Pencil, Save, X } from "lucide-react";
import RecordingDialog from "../../components/RecordingDialog";

type Senior = Record<string, any>;

export default function SeniorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recordOpen, setRecordOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Senior>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/seniors/${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setForm(json.senior);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function save() {
    const { diseases: _d, service_pattern: _s, ...patch } = form;
    const res = await fetch(`/api/seniors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setEditing(false);
      load();
    } else {
      alert("저장 실패");
    }
  }

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!data?.senior) return <div className="p-6">어르신을 찾을 수 없습니다.</div>;

  const s = data.senior;
  const journals = data.journals ?? [];
  const assignments = data.assignments ?? [];
  const history = data.history ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/seniors" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Link>

      {/* 기본정보 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>
            <p className="text-sm text-gray-500 mt-1">수급자 #{s.id}</p>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="inline-flex items-center px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                  <Pencil className="w-4 h-4 mr-1" /> 편집
                </button>
                <button onClick={() => setRecordOpen(true)} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Mic className="w-4 h-4 mr-2" /> 녹음 시작
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setForm(s); }} className="inline-flex items-center px-3 py-2 border rounded-lg text-sm">
                  <X className="w-4 h-4 mr-1" /> 취소
                </button>
                <button onClick={save} className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                  <Save className="w-4 h-4 mr-1" /> 저장
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          <Field label="등급" value={s.grade} editing={editing} onChange={(v) => setForm({ ...form, grade: v })} />
          <Field label="생년월일" value={s.birth_date} editing={editing} type="date" onChange={(v) => setForm({ ...form, birth_date: v })} />
          <Field label="장기요양인정번호" value={s.long_term_care_id} editing={editing} onChange={(v) => setForm({ ...form, long_term_care_id: v })} />
          <Field label="인정유효기간 시작" value={s.ltc_valid_from} editing={editing} type="date" onChange={(v) => setForm({ ...form, ltc_valid_from: v })} />
          <Field label="인정유효기간 종료" value={s.ltc_valid_to} editing={editing} type="date" onChange={(v) => setForm({ ...form, ltc_valid_to: v })} />
          <Field label="본인부담률(%)" value={s.copay_rate} editing={editing} onChange={(v) => setForm({ ...form, copay_rate: v ? Number(v) : null })} />
          <Field label="부담구분" value={s.copay_reason} editing={editing} onChange={(v) => setForm({ ...form, copay_reason: v })} />
          <Field label="복지유형" value={s.welfare_type} editing={editing} onChange={(v) => setForm({ ...form, welfare_type: v })} />
          <Field label="의료보장" value={s.medical_coverage} editing={editing} onChange={(v) => setForm({ ...form, medical_coverage: v })} />
          <Field label="월한도액" value={s.monthly_benefit_cap} editing={editing} onChange={(v) => setForm({ ...form, monthly_benefit_cap: v ? Number(v) : null })} />
          <Field label="주거형태" value={s.address_type} editing={editing} onChange={(v) => setForm({ ...form, address_type: v })} />
          <Field label="주소" value={s.address} editing={editing} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="주보호자 이름" value={s.guardian_name} editing={editing} onChange={(v) => setForm({ ...form, guardian_name: v })} />
          <Field label="주보호자 관계" value={s.guardian_relation} editing={editing} onChange={(v) => setForm({ ...form, guardian_relation: v })} />
          <Field label="주보호자 전화" value={s.guardian_phone} editing={editing} type="tel" inputMode="tel" onChange={(v) => setForm({ ...form, guardian_phone: v })} />
          <Field label="장애등록번호" value={s.disability_reg_no} editing={editing} onChange={(v) => setForm({ ...form, disability_reg_no: v })} />
          <Field label="장애등급" value={s.disability_grade} editing={editing} onChange={(v) => setForm({ ...form, disability_grade: v })} />
          <Field label="국가보훈여부" value={s.is_veteran ? "예" : "아니오"} editing={editing} onChange={(v) => setForm({ ...form, is_veteran: v === "예" })} />
        </div>

        {s.major_diseases?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">주요 질환</p>
            <div className="flex flex-wrap gap-2">
              {s.major_diseases.map((d: string) => (
                <span key={d} className="bg-red-50 text-red-700 text-xs px-2 py-1 rounded">{d}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 욕구사정 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">욕구사정 (최근 {s.assess_updated_at ? new Date(s.assess_updated_at).toLocaleDateString("ko-KR") : "-"})</h2>
        <div className="space-y-3">
          <AssessRow label="식사 및 영양" value={s.assess_meal} />
          <AssessRow label="보행" value={s.assess_mobility} />
          <AssessRow label="신체기능" value={s.assess_physical} />
          <AssessRow label="배뇨/배변" value={s.assess_excretion} />
          <AssessRow label="위생관리" value={s.assess_hygiene} />
          <AssessRow label="ADL" value={s.assess_adl} />
          <AssessRow label="인지기능" value={s.assess_cognition} />
          <AssessRow label="행동증상" value={s.assess_behavior} />
          <AssessRow label="가족/생활환경" value={s.assess_family_env} />
          <AssessRow label="종합의견" value={s.assess_summary} highlight />
        </div>
      </section>

      {/* 담당 요양보호사 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">담당 요양보호사</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">배정된 요양보호사가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">{a.caregivers?.name} <span className="text-xs text-gray-500">({a.role})</span></p>
                  <p className="text-xs text-gray-500">{a.caregivers?.phone} · {a.start_date} ~ {a.end_date ?? "진행중"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${a.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 이력 */}
      {history.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">이력</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h: any) => (
              <li key={h.id} className="border-l-2 border-indigo-200 pl-3"><span className="text-xs text-gray-500">{h.event_date}</span> · {h.event}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 일지 */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">돌봄 일지</h2>
          </div>
          <span className="text-sm text-gray-500">총 {journals.length}건</span>
        </div>
        {journals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">아직 작성된 일지가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {journals.map((j: any) => (
              <div key={j.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">
                    {new Date(j.created_at).toLocaleString("ko-KR")} · {Math.floor(j.duration / 60)}분 {j.duration % 60}초
                  </p>
                  {j.status === "processing" && <span className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="w-3 h-3 animate-spin" /> 변환 중</span>}
                  {j.status === "done" && <span className="text-xs text-green-600">완료</span>}
                  {j.status === "failed" && <span className="text-xs text-red-600">실패</span>}
                </div>
                {j.summary && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">📋 AI 일지 요약</p>
                    <p className="text-sm whitespace-pre-wrap bg-indigo-50 p-3 rounded">{j.summary}</p>
                  </div>
                )}
                {j.transcript && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-gray-500">원본 텍스트 보기</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{j.transcript}</p>
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
        title={`${s.name} 어르신 일지 녹음`}
        uploadUrl="/api/journals"
        uploadField="senior_id"
        entityId={s.id}
        onComplete={load}
      />
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text", inputMode }: {
  label: string;
  value: any;
  editing: boolean;
  onChange: (v: any) => void;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "decimal" | "email" | "url" | "search";
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      {editing ? (
        <input
          type={type}
          inputMode={inputMode}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-base"
        />
      ) : (
        <p className="font-medium text-sm break-all">{value ?? "-"}</p>
      )}
    </div>
  );
}

function AssessRow({ label, value, highlight = false }: { label: string; value: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className={`${highlight ? "bg-indigo-50 p-3 rounded" : ""}`}>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
