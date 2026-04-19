"use client";

import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, Pencil, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CENTER_INFO } from "@/lib/centerInfo";
import { buildHandoverAutofill, isHandoverEmpty } from "@/lib/handoverAutofill";

type Dict = Record<string, any>;

function Cb({ on, label, onToggle, editing }: { on: boolean; label: string; onToggle: () => void; editing: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 mr-3 leading-6 ${editing ? "cursor-pointer select-none" : ""}`}
      onClick={() => editing && onToggle()}
    >
      <span className="text-base leading-none">{on ? "■" : "□"}</span>
      <span className="text-sm">{label}</span>
    </span>
  );
}

function Inline({ value, onChange, editing, width, placeholder }: { value: any; onChange: (v: string) => void; editing: boolean; width?: string; placeholder?: string }) {
  const text = value == null || value === false ? "" : String(value);
  if (editing) {
    return (
      <input
        type="text"
        className="border-b border-gray-400 px-1 text-sm bg-yellow-50 focus:outline-none focus:bg-yellow-100"
        style={{ width: width ?? "8rem" }}
        value={text}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <span className="text-sm">{text || "\u00a0"}</span>;
}

function Block({ value, onChange, editing, rows = 2 }: { value: any; onChange: (v: string) => void; editing: boolean; rows?: number }) {
  const text = value == null ? "" : String(value);
  if (editing) {
    return (
      <textarea
        className="w-full border rounded px-1 py-1 text-sm bg-yellow-50 focus:outline-none focus:bg-yellow-100"
        rows={rows}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <span className="text-sm whitespace-pre-wrap">{text}</span>;
}

const SERVICE_BODY = [
  "세면도움",
  "몸단장",
  "목욕도움",
  "체위변경",
  "구강관리",
  "옷갈아입기",
  "화장실이용하기",
  "신체기능의 유지·증진",
  "식사도움",
  "머리감기기",
  "배설도움",
  "이동도움",
];

const SERVICE_HOUSEWORK = [
  "외출 시 동행",
  "취사",
  "일상 업무 대행",
  "청소 및 주변정돈",
  "시장보기",
  "세탁",
];

const SERVICE_EMOTION = ["말벗 격려", "기타"];

type Worker = { id: number; name: string; phone: string | null };

export default function HandoverPage() {
  const { id: seniorId } = useParams() as { id: string };
  const sp = useSearchParams();
  const { data, mutate } = useSWR<any>(`/api/seniors/${seniorId}`);
  const { data: intakeRes } = useSWR<any>(`/api/intake-forms?senior_id=${seniorId}`);
  const { data: workersRes } = useSWR<any>(`/api/workers?status=active`);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Dict | null>(null);
  const [saving, setSaving] = useState(false);

  const workers: Worker[] = useMemo(
    () => (workersRes?.data ?? workersRes?.caregivers ?? []).map((w: any) => ({ id: w.id, name: w.name, phone: w.phone })),
    [workersRes]
  );

  // 현재 active 인 caregiver_assignments 중 첫 번째를 기본 인계자로 추천
  const currentPrimary = useMemo(() => {
    const list = (data?.assignments ?? []).filter((a: any) => a.status === "active");
    if (!list.length) return null;
    // 주담당 우선
    const primary = list.find((a: any) => a.role === "주담당") ?? list[0];
    return primary;
  }, [data]);

  // 자동 채움 — handover_data 가 비었을 때만 (저장된 값은 절대 덮어쓰지 않음)
  const initial: Dict | null = useMemo(() => {
    if (!data?.senior) return null;
    const senior = data.senior;
    const stored: Dict = senior.handover_data ?? {};

    // 자동 채움 베이스 — 어르신/초기상담/욕구사정에서 추론
    let base: Dict = {};
    if (isHandoverEmpty(stored)) {
      const intake = (intakeRes?.intakes ?? [])[0] ?? null;
      base = buildHandoverAutofill({
        senior,
        intake,
        full: senior?.needs_assessment_full ?? null,
      });
    }

    // 저장값 > 자동값 > 어르신 마스터 (저장된 값이 항상 우선)
    const pick = (key: string, fallback?: any) => {
      if (stored[key] !== undefined && stored[key] !== null && stored[key] !== "") return stored[key];
      if (Array.isArray(stored[key]) && stored[key].length > 0) return stored[key];
      if (base[key] !== undefined && base[key] !== null && base[key] !== "") return base[key];
      if (Array.isArray(base[key]) && base[key].length > 0) return base[key];
      return fallback;
    };

    // URL 쿼리로 전달된 전임/후임 ID (서류 탭 피커에서 선택한 경우)
    const qFromId = sp.get("from_worker_id");
    const qToId = sp.get("to_worker_id");
    const qFromIdNum = qFromId ? Number(qFromId) : null;
    const qToIdNum = qToId ? Number(qToId) : null;
    const workers = (workersRes?.caregivers ?? workersRes?.data ?? []) as any[];
    const qFromName = qFromIdNum ? (workers.find((w: any) => w.id === qFromIdNum)?.name ?? "") : "";
    const qToName = qToIdNum ? (workers.find((w: any) => w.id === qToIdNum)?.name ?? "") : "";

    // 인계자 기본값: URL 쿼리 → 현재 활성 주담당
    const fromIdDefault = qFromIdNum ?? currentPrimary?.caregiver_id ?? null;
    const fromNameDefault = qFromName || currentPrimary?.caregivers?.name || "";
    const toIdDefault = qToIdNum ?? null;
    const toNameDefault = qToName || "";

    return {
      recipient_name: pick("recipient_name", senior.name ?? ""),
      birth_date: pick("birth_date", senior.birth_date ?? ""),
      phone: pick("phone", senior.phone ?? ""),
      guardian_name: pick("guardian_name", senior.guardian_name ?? ""),
      address: pick("address", senior.address ?? ""),
      service_body: stored.service_body ?? base.service_body ?? [],
      service_housework: stored.service_housework ?? base.service_housework ?? [],
      service_emotion: stored.service_emotion ?? base.service_emotion ?? [],
      service_note: pick("service_note", ""),
      disease_note: pick("disease_note", ""),
      dementia_yes: stored.dementia_yes !== undefined ? stored.dementia_yes : (base.dementia_yes ?? null),
      dementia_level: pick("dementia_level", ""),
      dementia_symptom: pick("dementia_symptom", ""),
      medication_yes: stored.medication_yes !== undefined ? stored.medication_yes : (base.medication_yes ?? null),
      medication_count: pick("medication_count", ""),
      medication_list: pick("medication_list", ""),
      life_environment_note: pick("life_environment_note", ""),
      handover_date: pick("handover_date", ""),
      handover_reason: pick("handover_reason", ""),
      from_worker: pick("from_worker", fromNameDefault),
      to_worker: pick("to_worker", toNameDefault),
      from_worker_id: stored.from_worker_id ?? base.from_worker_id ?? fromIdDefault ?? null,
      to_worker_id: stored.to_worker_id ?? base.to_worker_id ?? toIdDefault ?? null,
    };
  }, [data, intakeRes, currentPrimary, sp, workersRes]);

  if (!data || !workersRes) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!data.senior) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-3">
        <Link href={`/seniors/${seniorId}`} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 대상자로
        </Link>
        <div className="bg-white border rounded-xl p-6 text-center text-sm text-gray-500">
          어르신을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const senior = data.senior;
  const ed: Dict = (editing && draft ? draft : initial) ?? {};
  const update = (key: string, val: any) =>
    setDraft((prev) => ({ ...((prev ?? initial) ?? {}), [key]: val }));

  const toggleArr = (key: string, value: string) => {
    const cur: string[] = Array.isArray(ed[key]) ? ed[key] : [];
    const set = new Set(cur);
    if (set.has(value)) set.delete(value); else set.add(value);
    update(key, Array.from(set));
  };

  const setFromWorker = (idStr: string) => {
    const idNum = idStr === "" ? null : Number(idStr);
    const w = workers.find((x) => x.id === idNum);
    setDraft((prev) => ({
      ...((prev ?? initial) ?? {}),
      from_worker_id: idNum,
      from_worker: w?.name ?? "",
    }));
  };
  const setToWorker = (idStr: string) => {
    const idNum = idStr === "" ? null : Number(idStr);
    const w = workers.find((x) => x.id === idNum);
    setDraft((prev) => ({
      ...((prev ?? initial) ?? {}),
      to_worker_id: idNum,
      to_worker: w?.name ?? "",
    }));
  };

  const startEdit = () => { setDraft({ ...(initial ?? {}) }); setEditing(true); };
  const cancel = () => { setDraft(null); setEditing(false); };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      // 재배정 여부: 인수자(to)가 지정돼 있고, 현재 활성 주담당과 다를 때
      const toId = draft.to_worker_id ?? null;
      const fromId = draft.from_worker_id ?? null;
      const willReassign = !!toId && Number(toId) !== Number(fromId ?? -1);
      let confirmed = true;
      if (willReassign) {
        const fromName = draft.from_worker || "전임 요양보호사";
        const toName = draft.to_worker || "후임 요양보호사";
        confirmed = confirm(
          `저장과 함께 담당 요양보호사를 다음과 같이 변경합니다.\n\n` +
          `${fromName} → ${toName}\n\n계속할까요?`
        );
      }
      if (!confirmed) {
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/seniors/${seniorId}/handover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handover_data: draft,
          reassign: willReassign,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "저장 실패");
      }
      setDraft(null);
      setEditing(false);
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 인계인수일
  const parseDate = (s: string) => {
    const parts = String(s ?? "").split("-");
    return { y: parts[0] ?? "", mo: parts[1] ?? "", d: parts[2] ?? "" };
  };
  const dateParts = parseDate(ed.handover_date);
  const setDatePart = (part: "y" | "mo" | "d", v: string) => {
    const cur = parseDate(ed.handover_date);
    cur[part] = v.replace(/[^\d]/g, "");
    update("handover_date", `${cur.y}-${cur.mo}-${cur.d}`);
  };

  // 인계인수일은 "YYYY-MM-DD" 또는 "YY-MM-DD" 모두 받기 — 화면엔 뒤 두자리만 표기
  const yShort = (() => {
    const y = String(dateParts.y ?? "");
    if (y.length === 4) return y.slice(2);
    return y;
  })();

  const thL = "border border-black bg-gray-50 text-center align-middle text-xs font-medium px-1 py-1";
  const td = "border border-black px-2 py-1.5 align-middle text-sm";

  const isEmpty = (v: any) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
  const ec = (v: any) => (isEmpty(v) ? " empty-mark" : "");
  const ecAny = (...vs: any[]) => (vs.every((v) => isEmpty(v)) ? " empty-mark" : "");

  return (
    <>
      <div className="no-print px-4 py-3 max-w-5xl mx-auto flex items-center justify-between gap-2">
        <Link href={`/seniors/${seniorId}`} className="inline-flex items-center text-sm text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-1" /> 대상자로
        </Link>
        <div className="flex gap-2 flex-wrap justify-end">
          {editing ? (
            <>
              <button onClick={cancel} disabled={saving} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                <X className="w-4 h-4" /> 취소
              </button>
              <button onClick={save} disabled={saving} className="min-h-[40px] px-3 py-2 bg-green-600 active:bg-green-800 text-white rounded-lg text-sm inline-flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="min-h-[40px] px-3 py-2 bg-gray-100 active:bg-gray-300 rounded-lg text-sm inline-flex items-center gap-1">
                <Pencil className="w-4 h-4" /> 편집
              </button>
              <button onClick={() => window.print()} className="min-h-[40px] px-3 py-2 bg-indigo-600 active:bg-indigo-800 text-white rounded-lg text-sm inline-flex items-center gap-1">
                <Printer className="w-4 h-4" /> 인쇄
              </button>
            </>
          )}
        </div>
      </div>

      <article className="print-sheet max-w-5xl mx-auto bg-white border p-6 sm:p-10 mb-4">
        <h1 className="text-3xl font-bold text-center mb-5">업무 인계·인수 확인서</h1>

        {/* 1. 수급자 정보 */}
        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <th className={`${thL} w-12`} rowSpan={2}>수<br/>급<br/>자<br/>정<br/>보</th>
              <th className={`${thL} w-20`}>성 명</th>
              <td className={`${td}${ec(ed.recipient_name)}`}><Inline value={ed.recipient_name} onChange={(v) => update("recipient_name", v)} editing={editing} /></td>
              <th className={`${thL} w-20`}>생년월일</th>
              <td className={`${td}${ec(ed.birth_date)}`}><Inline value={ed.birth_date} onChange={(v) => update("birth_date", v)} editing={editing} /></td>
              <th className={`${thL} w-20`}>연락처</th>
              <td className={`${td}${ec(ed.phone)}`}><Inline value={ed.phone} onChange={(v) => update("phone", v)} editing={editing} /></td>
            </tr>
            <tr>
              <th className={thL}>보호자명</th>
              <td className={`${td}${ec(ed.guardian_name)}`}><Inline value={ed.guardian_name} onChange={(v) => update("guardian_name", v)} editing={editing} /></td>
              <th className={thL}>주 소</th>
              <td className={`${td}${ec(ed.address)}`} colSpan={3}><Inline value={ed.address} onChange={(v) => update("address", v)} editing={editing} width="100%" /></td>
            </tr>
          </tbody>
        </table>

        {/* 2. 급여제공내용 (최근 10일) */}
        <p className="text-sm font-semibold mt-4 mb-1">급여제공내용 <span className="text-xs font-normal text-gray-600">(최근 10일)</span></p>
        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <th className={`${thL} w-12`} rowSpan={4}>방<br/>문<br/>요<br/>양<br/>/<br/>목<br/>욕</th>
              <th className={`${thL} w-32`}>신체활동 지원<br/><span className="font-normal text-[11px]">(1회 30분)</span></th>
              <td className={`${td}${ec(ed.service_body)}`}>
                <div className="grid grid-cols-3 gap-y-1">
                  {SERVICE_BODY.map((it) => (
                    <Cb key={it} on={(ed.service_body ?? []).includes(it)} label={it} onToggle={() => toggleArr("service_body", it)} editing={editing} />
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <th className={thL}>가사 및 일상생활 지원<br/><span className="font-normal text-[11px]">(1회 90분)</span></th>
              <td className={`${td}${ec(ed.service_housework)}`}>
                <div className="grid grid-cols-3 gap-y-1">
                  {SERVICE_HOUSEWORK.map((it) => (
                    <Cb key={it} on={(ed.service_housework ?? []).includes(it)} label={it} onToggle={() => toggleArr("service_housework", it)} editing={editing} />
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <th className={thL}>정서지원<br/><span className="font-normal text-[11px]">(1회 30분)</span></th>
              <td className={`${td}${ec(ed.service_emotion)}`}>
                {SERVICE_EMOTION.map((it) => (
                  <Cb key={it} on={(ed.service_emotion ?? []).includes(it)} label={it} onToggle={() => toggleArr("service_emotion", it)} editing={editing} />
                ))}
              </td>
            </tr>
            <tr>
              <th className={thL}>내 용</th>
              <td className={`${td}${ec(ed.service_note)}`}><Block value={ed.service_note} onChange={(v) => update("service_note", v)} editing={editing} rows={3} /></td>
            </tr>
          </tbody>
        </table>

        {/* 3. 수급자건강상태 */}
        <p className="text-sm font-semibold mt-4 mb-1">수급자건강상태</p>
        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <th className={`${thL} w-1/3`}>질병 및 신체상태</th>
              <th className={`${thL} w-1/3`}>치매여부</th>
              <th className={`${thL} w-1/3`}>약 복용</th>
            </tr>
            <tr>
              <td className={`${td}${ec(ed.disease_note)}`} style={{ verticalAlign: "top" }}>
                <Block value={ed.disease_note} onChange={(v) => update("disease_note", v)} editing={editing} rows={5} />
              </td>
              <td className={`${td}${ecAny(ed.dementia_yes, ed.dementia_symptom, ed.dementia_level)}`} style={{ verticalAlign: "top" }}>
                <div className="space-y-1">
                  <div>
                    <Cb on={ed.dementia_yes === true} label="유" onToggle={() => update("dementia_yes", ed.dementia_yes === true ? null : true)} editing={editing} />
                    <span className="text-sm ml-2">(
                      <Cb on={ed.dementia_level === "상"} label="상" onToggle={() => update("dementia_level", ed.dementia_level === "상" ? "" : "상")} editing={editing} />
                      <Cb on={ed.dementia_level === "중"} label="중" onToggle={() => update("dementia_level", ed.dementia_level === "중" ? "" : "중")} editing={editing} />
                      <Cb on={ed.dementia_level === "하"} label="하" onToggle={() => update("dementia_level", ed.dementia_level === "하" ? "" : "하")} editing={editing} />
                    )</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-700">※ 치매행동·증상:</span>
                    <div className="mt-0.5"><Block value={ed.dementia_symptom} onChange={(v) => update("dementia_symptom", v)} editing={editing} rows={2} /></div>
                  </div>
                  <div>
                    <Cb on={ed.dementia_yes === false} label="무" onToggle={() => update("dementia_yes", ed.dementia_yes === false ? null : false)} editing={editing} />
                  </div>
                </div>
              </td>
              <td className={`${td}${ecAny(ed.medication_yes, ed.medication_count, ed.medication_list)}`} style={{ verticalAlign: "top" }}>
                <div className="space-y-1">
                  <div>
                    <Cb on={ed.medication_yes === true} label="유" onToggle={() => update("medication_yes", ed.medication_yes === true ? null : true)} editing={editing} />
                    <span className="text-sm ml-1">(<Inline value={ed.medication_count} onChange={(v) => update("medication_count", v)} editing={editing} width="3rem" /> 가지)</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-700">※ 복용중인 약:</span>
                    <div className="mt-0.5"><Block value={ed.medication_list} onChange={(v) => update("medication_list", v)} editing={editing} rows={2} /></div>
                  </div>
                  <div>
                    <Cb on={ed.medication_yes === false} label="무" onToggle={() => update("medication_yes", ed.medication_yes === false ? null : false)} editing={editing} />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. 생활환경 및 특이사항 */}
        <p className="text-sm font-semibold mt-4 mb-1">생활환경 및 특이사항</p>
        <table className="w-full border-collapse mb-3">
          <tbody>
            <tr>
              <td className={`${td}${ec(ed.life_environment_note)}`} style={{ minHeight: "80px" }}>
                <Block value={ed.life_environment_note} onChange={(v) => update("life_environment_note", v)} editing={editing} rows={5} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer table — 인계인수일 / 인계자 / 인수자 */}
        <table className="w-full border-collapse mb-3 mt-6">
          <tbody>
            <tr>
              <th className={`${thL} w-24`}>인계인수일</th>
              <td className={`${td}${ec(ed.handover_date)}`}>
                <span className="text-sm">20</span>
                <Inline value={yShort} onChange={(v) => setDatePart("y", v)} editing={editing} width="3rem" />
                <span className="text-sm"> 년 </span>
                <Inline value={dateParts.mo} onChange={(v) => setDatePart("mo", v)} editing={editing} width="3rem" />
                <span className="text-sm"> 월 </span>
                <Inline value={dateParts.d} onChange={(v) => setDatePart("d", v)} editing={editing} width="3rem" />
                <span className="text-sm"> 일</span>
              </td>
              <th className={`${thL} w-24`}>인계사유</th>
              <td className={`${td}${ec(ed.handover_reason)}`}><Inline value={ed.handover_reason} onChange={(v) => update("handover_reason", v)} editing={editing} width="100%" /></td>
            </tr>
            <tr>
              <th className={thL}>인계자</th>
              <td className={`${td}${ec(ed.from_worker)}`}>
                {editing ? (
                  <select
                    className="border-b border-gray-400 px-1 text-sm bg-yellow-50 focus:outline-none focus:bg-yellow-100"
                    style={{ minWidth: "10rem" }}
                    value={ed.from_worker_id ?? ""}
                    onChange={(e) => setFromWorker(e.target.value)}
                  >
                    <option value="">— 선택 —</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">{ed.from_worker || "\u00a0"}</span>
                )}
                <span className="text-sm ml-2">(인)</span>
              </td>
              <th className={thL}>인수자</th>
              <td className={`${td}${ec(ed.to_worker)}`}>
                {editing ? (
                  <select
                    className="border-b border-gray-400 px-1 text-sm bg-yellow-50 focus:outline-none focus:bg-yellow-100"
                    style={{ minWidth: "10rem" }}
                    value={ed.to_worker_id ?? ""}
                    onChange={(e) => setToWorker(e.target.value)}
                  >
                    <option value="">— 선택 —</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">{ed.to_worker || "\u00a0"}</span>
                )}
                <span className="text-sm ml-2">(인)</span>
              </td>
            </tr>
          </tbody>
        </table>

        {editing && (ed.to_worker_id != null) && Number(ed.to_worker_id) !== Number(ed.from_worker_id ?? -1) && (
          <div className="no-print mt-2 p-2 rounded border border-amber-300 bg-amber-50 text-xs text-amber-900">
            저장 시 담당 요양보호사가 <b>{ed.from_worker || "전임"}</b> → <b>{ed.to_worker || "후임"}</b> 으로 자동 변경됩니다.
          </div>
        )}

        <p className="text-center text-xs mt-8">장기요양 고시 제9조 비밀보장의 원칙에 따라 수급자의 정보를 타인에게 누설하거나 제공하지 않는다.</p>
        <p className="text-center text-sm font-semibold mt-2">재가노인복지시설 {CENTER_INFO.name}</p>

        <footer className="mt-8 pt-4 border-t text-xs text-gray-500 text-right no-print">
          출력일: {new Date().toLocaleDateString("ko-KR")}
        </footer>
      </article>
    </>
  );
}
