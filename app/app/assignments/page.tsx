"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, AlertCircle } from "lucide-react";

type Senior = {
  id: number;
  name: string;
  grade: string | null;
  birth_date: string | null;
  long_term_care_id: string | null;
};

type Caregiver = { id: number; name: string; phone: string | null };

type Assignment = {
  id: number;
  senior_id: number;
  caregiver_id: number;
  role: string;
  start_date: string;
  end_date: string | null;
  seniors: { name: string } | null;
  caregivers: { name: string; phone: string | null } | null;
};

const GRADE_COLORS: Record<string, string> = {
  "1등급": "bg-red-100 text-red-700",
  "2등급": "bg-orange-100 text-orange-700",
  "3등급": "bg-yellow-100 text-yellow-700",
  "4등급": "bg-green-100 text-green-700",
  "5등급": "bg-blue-100 text-blue-700",
  "인지지원등급": "bg-purple-100 text-purple-700",
};

export default function AssignmentsPage() {
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState<Senior | null>(null);
  const [addingForCg, setAddingForCg] = useState<Caregiver | null>(null);
  const [view, setView] = useState<"senior" | "caregiver">("senior");

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, wRes, aRes] = await Promise.all([
      fetch("/api/seniors").then((r) => r.json()),
      fetch("/api/workers").then((r) => r.json()),
      fetch("/api/assignments?status=active").then((r) => r.json()),
    ]);
    setSeniors(sRes.data ?? []);
    setCaregivers(wRes.data ?? []);
    setAssignments(aRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 어르신별 배정된 요양보호사 그룹
  const bySenior = new Map<number, Assignment[]>();
  for (const a of assignments) {
    if (!bySenior.has(a.senior_id)) bySenior.set(a.senior_id, []);
    bySenior.get(a.senior_id)!.push(a);
  }

  const sorted = [...seniors].sort((a, b) => {
    const aMatched = (bySenior.get(a.id) ?? []).length > 0;
    const bMatched = (bySenior.get(b.id) ?? []).length > 0;
    if (aMatched !== bMatched) return aMatched ? 1 : -1; // 미배정 우선
    return a.name.localeCompare(b.name, "ko");
  });

  const unassignedCount = seniors.length - new Set([...bySenior.keys()].filter((id) => seniors.some((s) => s.id === id))).size;

  async function end(id: number) {
    if (!confirm("이 배정을 종료하시겠습니까?")) return;
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">담당배정</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          어르신 {seniors.length}명 · 요양보호사 {caregivers.length}명 · 배정 {assignments.length}건
          {unassignedCount > 0 && view === "senior" && <span className="text-amber-600 ml-2">· 미배정 {unassignedCount}명</span>}
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setView("senior")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "senior" ? "bg-white shadow-sm" : "text-gray-600"}`}
        >
          어르신 기준
        </button>
        <button
          onClick={() => setView("caregiver")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "caregiver" ? "bg-white shadow-sm" : "text-gray-600"}`}
        >
          요양보호사 기준
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : view === "caregiver" ? (
        <CaregiverView caregivers={caregivers} assignments={assignments} onAdd={setAddingForCg} onEnd={end} />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => {
            const mine = bySenior.get(s.id) ?? [];
            const unassigned = mine.length === 0;
            return (
              <div
                key={s.id}
                className={`bg-white border rounded-xl p-4 ${unassigned ? "border-amber-300" : ""}`}
              >
                <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {unassigned && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                      <span className="font-semibold">{s.name}</span>
                      {s.grade && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${GRADE_COLORS[s.grade] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.grade}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{s.long_term_care_id ?? ""}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mine.length === 0 ? (
                        <span className="text-sm text-amber-600">담당 요양보호사 미배정</span>
                      ) : (
                        mine.map((a) => (
                          <span key={a.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-sm px-2 py-1 rounded-full">
                            {a.caregivers?.name}
                            <button
                              onClick={(e) => { e.preventDefault(); end(a.id); }}
                              className="ml-1 text-blue-400 hover:text-red-500"
                              title="종료"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setAddingFor(s)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" /> 추가
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addingFor && (
        <AddAssignmentModal
          senior={addingFor}
          caregivers={caregivers}
          existing={bySenior.get(addingFor.id) ?? []}
          onClose={() => setAddingFor(null)}
          onSaved={() => { setAddingFor(null); load(); }}
        />
      )}

      {addingForCg && (
        <AddSeniorAssignmentModal
          caregiver={addingForCg}
          seniors={seniors}
          existing={assignments.filter((a) => a.caregiver_id === addingForCg.id)}
          onClose={() => setAddingForCg(null)}
          onSaved={() => { setAddingForCg(null); load(); }}
        />
      )}
    </div>
  );
}

function CaregiverView({
  caregivers, assignments, onAdd, onEnd,
}: {
  caregivers: Caregiver[];
  assignments: Assignment[];
  onAdd: (c: Caregiver) => void;
  onEnd: (id: number) => void;
}) {
  const byCg = new Map<number, Assignment[]>();
  for (const a of assignments) {
    if (!byCg.has(a.caregiver_id)) byCg.set(a.caregiver_id, []);
    byCg.get(a.caregiver_id)!.push(a);
  }
  const sorted = [...caregivers].sort((a, b) => {
    const an = byCg.get(a.id)?.length ?? 0;
    const bn = byCg.get(b.id)?.length ?? 0;
    if (an !== bn) return bn - an; // 많이 맡은 순
    return a.name.localeCompare(b.name, "ko");
  });

  return (
    <div className="space-y-2">
      {sorted.map((c) => {
        const mine = byCg.get(c.id) ?? [];
        return (
          <div key={c.id} className="bg-white border rounded-xl p-4">
            <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{c.name}</span>
                  {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                  <span className="text-xs text-gray-400">· 담당 {mine.length}명</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mine.length === 0 ? (
                    <span className="text-sm text-gray-400">담당 어르신 없음</span>
                  ) : (
                    mine.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 bg-green-50 text-green-800 text-sm px-2 py-1 rounded-full">
                        {a.seniors?.name}
                        <button
                          onClick={(e) => { e.preventDefault(); onEnd(a.id); }}
                          className="ml-1 text-green-500 hover:text-red-500"
                          title="종료"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <button
                onClick={() => onAdd(c)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" /> 추가
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddSeniorAssignmentModal({
  caregiver, seniors, existing, onClose, onSaved,
}: {
  caregiver: Caregiver;
  seniors: Senior[];
  existing: Assignment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  type Row = { checked: boolean; role: string; assignmentId?: number };
  const [selections, setSelections] = useState<Map<number, Row>>(() => {
    const m = new Map<number, Row>();
    for (const a of existing) {
      m.set(a.senior_id, { checked: true, role: a.role, assignmentId: a.id });
    }
    return m;
  });

  const filtered = seniors.filter((s) => !q || s.name.includes(q));
  const checkedCount = [...selections.values()].filter((v) => v.checked).length;

  function toggle(sId: number) {
    const cur = selections.get(sId);
    const next = new Map(selections);
    if (!cur) {
      next.set(sId, { checked: true, role: "primary" });
    } else {
      next.set(sId, { ...cur, checked: !cur.checked });
    }
    setSelections(next);
  }

  function setRole(sId: number, role: string) {
    const cur = selections.get(sId);
    if (!cur) return;
    const next = new Map(selections);
    next.set(sId, { ...cur, role });
    setSelections(next);
  }

  async function save() {
    setSaving(true);
    try {
      const tasks: Promise<any>[] = [];
      for (const [, row] of selections) {
        if (row.assignmentId && !row.checked) {
          tasks.push(fetch(`/api/assignments/${row.assignmentId}`, { method: "DELETE" }));
        }
      }
      for (const [, row] of selections) {
        if (row.assignmentId && row.checked) {
          const old = existing.find((a) => a.id === row.assignmentId);
          if (old && old.role !== row.role) {
            tasks.push(fetch(`/api/assignments/${row.assignmentId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: row.role }),
            }));
          }
        }
      }
      for (const [sId, row] of selections) {
        if (!row.assignmentId && row.checked) {
          tasks.push(fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senior_id: sId,
              caregiver_id: caregiver.id,
              role: row.role,
              start_date: new Date().toISOString().slice(0, 10),
            }),
          }));
        }
      }
      await Promise.all(tasks);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <p className="text-xs text-gray-500">담당 어르신 매칭</p>
            <h2 className="font-semibold">{caregiver.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">선택된 {checkedCount}명 · 중복 선택 가능</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 border-b">
          <input
            type="text"
            autoFocus
            placeholder="어르신 이름 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">결과 없음</p>
          ) : (
            filtered.map((s) => {
              const row = selections.get(s.id);
              const checked = !!row?.checked;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${checked ? "bg-green-50" : ""}`}
                >
                  <button
                    onClick={() => toggle(s.id)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-green-600 border-green-600" : "border-gray-300"}`}
                  >
                    {checked && <span className="text-white text-sm">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => toggle(s.id)}>
                    <p className="font-medium">
                      {s.name}
                      {s.grade && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${GRADE_COLORS[s.grade] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.grade}
                        </span>
                      )}
                    </p>
                    {s.long_term_care_id && <p className="text-xs text-gray-500">{s.long_term_care_id}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">취소</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? "저장중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAssignmentModal({
  senior, caregivers, existing, onClose, onSaved,
}: {
  senior: Senior;
  caregivers: Caregiver[];
  existing: Assignment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  // caregiverId → {checked, role, assignmentId(없으면 새로 추가)}
  type Row = { checked: boolean; role: string; assignmentId?: number };
  const [selections, setSelections] = useState<Map<number, Row>>(() => {
    const m = new Map<number, Row>();
    for (const a of existing) {
      m.set(a.caregiver_id, { checked: true, role: a.role, assignmentId: a.id });
    }
    return m;
  });

  const filtered = caregivers.filter((c) => !q || c.name.includes(q));
  const checkedCount = [...selections.values()].filter((v) => v.checked).length;

  function toggle(cgId: number) {
    const cur = selections.get(cgId);
    const next = new Map(selections);
    if (!cur) {
      const firstPrimary = [...selections.values()].some((v) => v.checked && v.role === "primary");
      next.set(cgId, { checked: true, role: firstPrimary ? "secondary" : "primary" });
    } else {
      next.set(cgId, { ...cur, checked: !cur.checked });
    }
    setSelections(next);
  }

  function setRole(cgId: number, role: string) {
    const cur = selections.get(cgId);
    if (!cur) return;
    const next = new Map(selections);
    next.set(cgId, { ...cur, role });
    setSelections(next);
  }

  async function save() {
    setSaving(true);
    try {
      const tasks: Promise<any>[] = [];
      // 체크 해제 → 종료
      for (const [cgId, row] of selections) {
        if (row.assignmentId && !row.checked) {
          tasks.push(fetch(`/api/assignments/${row.assignmentId}`, { method: "DELETE" }));
        }
      }
      // 역할 변경된 기존
      for (const [cgId, row] of selections) {
        if (row.assignmentId && row.checked) {
          const old = existing.find((a) => a.id === row.assignmentId);
          if (old && old.role !== row.role) {
            tasks.push(fetch(`/api/assignments/${row.assignmentId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: row.role }),
            }));
          }
        }
      }
      // 새로 체크된 것
      for (const [cgId, row] of selections) {
        if (!row.assignmentId && row.checked) {
          tasks.push(fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senior_id: senior.id,
              caregiver_id: cgId,
              role: row.role,
              start_date: new Date().toISOString().slice(0, 10),
            }),
          }));
        }
      }
      await Promise.all(tasks);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <p className="text-xs text-gray-500">담당 요양보호사 매칭</p>
            <h2 className="font-semibold">{senior.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">선택된 {checkedCount}명 · 중복 선택 가능</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 border-b">
          <input
            type="text"
            autoFocus
            placeholder="요양보호사 이름 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">결과 없음</p>
          ) : (
            filtered.map((c) => {
              const row = selections.get(c.id);
              const checked = !!row?.checked;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${checked ? "bg-indigo-50" : ""}`}
                >
                  <button
                    onClick={() => toggle(c.id)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}
                  >
                    {checked && <span className="text-white text-sm">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => toggle(c.id)}>
                    <p className="font-medium">{c.name}</p>
                    {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">취소</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? "저장중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
