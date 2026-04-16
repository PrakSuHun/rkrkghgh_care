"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, FileText, Loader2, Check } from "lucide-react";
import { invalidate } from "@/lib/swr";

type Extracted = Record<string, any>;

export default function NewSeniorPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [intakeId, setIntakeId] = useState<number | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const uploadAndExtract = async () => {
    if (!file) return;
    setErr(null); setUploading(true);
    try {
      const safeName = `intake_${Date.now()}.pdf`;
      const urlRes = await fetch("/api/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: safeName, bucket: "intake" }),
      });
      const urlJ = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlJ.error ?? "업로드 URL 발급 실패");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", urlJ.signedUrl);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.setRequestHeader("x-upsert", "true");
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 ${xhr.status}`));
        xhr.onerror = () => reject(new Error("네트워크 오류"));
        xhr.send(file);
      });
      setUploading(false); setExtracting(true);

      const ext = await fetch("/api/intake-forms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_path: urlJ.path }),
      });
      const extJ = await ext.json();
      if (!ext.ok) throw new Error(extJ.error ?? "AI 추출 실패");
      setIntakeId(extJ.intake.id);
      setExtracted(extJ.intake.extracted_data ?? {});
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false); setExtracting(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setExtracted({ ...(extracted ?? {}), [key]: value });
  };

  const link = async () => {
    if (!intakeId || !extracted) return;
    if (!extracted.name) { setErr("이름은 필수입니다"); return; }
    setSaving(true); setErr(null);
    try {
      await fetch(`/api/intake-forms/${intakeId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: extracted }),
      });
      const linkRes = await fetch(`/api/intake-forms/${intakeId}/link`, { method: "POST" });
      const linkJ = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkJ.error ?? "등록 실패");
      invalidate("/api/seniors", "/api/intake-forms");
      router.push(`/seniors/${linkJ.senior.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/seniors" className="inline-flex items-center text-sm text-gray-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
      </Link>
      <h1 className="text-xl font-bold">어르신 등록</h1>

      {!extracted && (
        <section className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold">초기상담기록지 업로드 (AI 자동 입력)</h2>
          </div>
          <p className="text-xs text-gray-500">PDF를 올리면 AI가 내용을 추출해 자동으로 등록 폼을 채웁니다.</p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <button
            onClick={uploadAndExtract}
            disabled={!file || uploading || extracting}
            className="w-full min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...</> :
             extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중 (약 1~2분)...</> :
             <><Upload className="w-4 h-4" /> PDF 올리고 분석하기</>}
          </button>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </section>
      )}

      {extracted && (
        <section className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold">추출 완료 — 내용 확인 후 등록</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="이름" value={extracted.name} onChange={(v) => updateField("name", v)} />
            <Field label="생년월일" type="date" value={extracted.birth_date} onChange={(v) => updateField("birth_date", v)} />
            <Field label="등급" value={extracted.grade} onChange={(v) => updateField("grade", v)} />
            <Field label="성별" value={extracted.gender === "M" ? "남" : extracted.gender === "F" ? "여" : ""} onChange={(v) => updateField("gender", v === "남" ? "M" : v === "여" ? "F" : null)} />
            <Field label="혈액형" value={extracted.blood_type} onChange={(v) => updateField("blood_type", v)} />
            <Field label="학력" value={extracted.education} onChange={(v) => updateField("education", v)} />
            <Field label="고향" value={extracted.hometown} onChange={(v) => updateField("hometown", v)} />
            <Field label="경제상태" value={extracted.economic_status} onChange={(v) => updateField("economic_status", v)} />
            <Field label="키(cm)" type="number" value={extracted.height_cm} onChange={(v) => updateField("height_cm", v ? Number(v) : null)} />
            <Field label="체중(kg)" type="number" value={extracted.weight_kg} onChange={(v) => updateField("weight_kg", v ? Number(v) : null)} />
            <Field label="보호자 이름" value={extracted.guardian_name} onChange={(v) => updateField("guardian_name", v)} />
            <Field label="보호자 관계" value={extracted.guardian_relation} onChange={(v) => updateField("guardian_relation", v)} />
            <Field label="보호자 연락처" type="tel" value={extracted.guardian_phone} onChange={(v) => updateField("guardian_phone", v)} />
            <Field label="동거여부" value={extracted.cohabit} onChange={(v) => updateField("cohabit", v)} />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">주요 질환</p>
            <input
              value={(extracted.diseases ?? []).join(", ")}
              onChange={(e) => updateField("diseases", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <LongField label="병력 / 발병시기" value={extracted.disease_history} onChange={(v) => updateField("disease_history", v)} />
          <LongField label="복용약" value={extracted.medications} onChange={(v) => updateField("medications", v)} />
          <LongField label="상담자 의견" value={extracted.counselor_opinion} onChange={(v) => updateField("counselor_opinion", v)} />

          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            onClick={link}
            disabled={saving}
            className="w-full min-h-[48px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> 등록 중...</> : "대상자로 등록 (낙상평가 자동 생성)"}
          </button>
        </section>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}

function LongField({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
