"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, FileText, Loader2, Check, Mic, Edit3 } from "lucide-react";
import { invalidate } from "@/lib/swr";
import RecordingDialog from "@/app/components/RecordingDialog";

type Extracted = Record<string, any>;
type Mode = "pdf" | "audio" | "manual";

export default function NewSeniorPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pdf");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [recordOpen, setRecordOpen] = useState(false);

  const [manualText, setManualText] = useState("");
  const [seniorName, setSeniorName] = useState("");

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

  const submitManual = async () => {
    if (!seniorName.trim()) { setErr("대상자 이름을 입력해주세요"); return; }
    if (!manualText.trim()) { setErr("내용을 입력해주세요"); return; }
    setErr(null); setExtracting(true);
    try {
      const prefixed = `대상자 이름: ${seniorName.trim()}\n\n${manualText}`;
      const res = await fetch("/api/intake-forms/from-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prefixed }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "AI 추출 실패");
      setIntakeId(j.intake.id);
      const data = j.intake.extracted_data ?? {};
      if (!data.name) data.name = seniorName.trim();
      setExtracted(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const onRecordingComplete = (result: any) => {
    if (result?.intake) {
      setIntakeId(result.intake.id);
      const data = result.intake.extracted_data ?? {};
      if (!data.name && seniorName.trim()) data.name = seniorName.trim();
      setExtracted(data);
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

  const TabBtn = ({ m, icon, label }: { m: Mode; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => { setMode(m); setErr(null); }}
      className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1 ${mode === m ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 active:bg-gray-200"}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="px-4 py-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/seniors" className="inline-flex items-center text-sm text-gray-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
      </Link>
      <h1 className="text-xl font-bold">어르신 등록</h1>

      {!extracted && (
        <>
          <div className="flex gap-2">
            <TabBtn m="audio" icon={<Mic className="w-4 h-4" />} label="녹음" />
            <TabBtn m="manual" icon={<Edit3 className="w-4 h-4" />} label="수기" />
            <TabBtn m="pdf" icon={<FileText className="w-4 h-4" />} label="PDF 업로드" />
          </div>

          {mode === "audio" && (
            <section className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-red-500" />
                <h2 className="font-semibold">녹음으로 초기상담기록지 생성</h2>
              </div>
              <p className="text-xs text-gray-500">상담 내용을 녹음하면 AI가 초기상담기록지 양식에 맞춰 자동으로 추출합니다. 추출된 내용은 다음 단계에서 수정할 수 있습니다.</p>
              <div>
                <label className="block text-xs text-gray-600 mb-1">대상자 이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={seniorName}
                  onChange={(e) => setSeniorName(e.target.value)}
                  placeholder="예: 전대순"
                  className="w-full min-h-[40px] border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <details className="bg-gray-50 border rounded-lg p-3">
                <summary className="text-xs font-semibold text-gray-700 cursor-pointer">녹음 가이드 — 어떤 내용을 말할까요?</summary>
                <div className="mt-2 text-xs text-gray-600 space-y-1.5 leading-relaxed">
                  <p>다음 순서대로 자연스럽게 말해주세요. 기억나는 것만 말해도 됩니다.</p>
                  <p><b>1) 기본 정보</b><br/>이름, 성별, 생년월일, 등급, 고향, 학력, 종교, 경제상태, 키/체중, 배우자 유무</p>
                  <p><b>2) 보호자</b><br/>보호자 이름, 관계, 연락처, 자녀수, 동거/왕래 여부</p>
                  <p><b>3) 일상생활</b><br/>보행·식사·용변 (자립/도움/완전도움), 정서 상태, 개인성향, 습관(음주·흡연 등)</p>
                  <p><b>4) 영양</b><br/>치아 상태, 배변, 식사 형태(일반식·다짐찬·유동식·경관식)</p>
                  <p><b>5) 회화</b><br/>시력, 청력(이명·보청기), 말하기</p>
                  <p><b>6) 병력·질환</b><br/>발병시기, 주 의료기관, 주요 질환(고혈압·당뇨·치매·관절염 등), 복용약</p>
                  <p><b>7) 종합</b><br/>개별욕구(어떤 도움이 필요한지), 상담자 의견</p>
                  <p className="text-gray-500 mt-2 pt-2 border-t">예시: "전대순 어르신, 여성, 1935년 10월 15일생. 4등급. 경제상태는 일반. 배우자 없음. 보호자는 큰아들 이현수 010-8475-3336. 자녀 2남1녀, 주 1~2회 왕래. 보행 도움 필요하고 식사는 자립. 정서는 조금 불안. 고혈압·당뇨 있으시고 2025년 7월 담석 수술 받음. 주 의료기관은 성모병원. 복용약은 당뇨·고혈압·퇴행성이명..."</p>
                </div>
              </details>
              <button
                onClick={() => { if (!seniorName.trim()) { setErr("대상자 이름을 입력해주세요"); return; } setErr(null); setRecordOpen(true); }}
                disabled={extracting}
                className="w-full min-h-[44px] bg-red-500 active:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" /> 녹음 시작
              </button>
              {extracting && <p className="text-sm text-gray-500 inline-flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...</p>}
              {err && <p className="text-sm text-red-600">{err}</p>}
            </section>
          )}

          {mode === "manual" && (
            <section className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold">수기로 초기상담기록지 생성</h2>
              </div>
              <p className="text-xs text-gray-500">상담 내용을 자유롭게 입력하면 AI가 초기상담기록지 양식에 맞춰 자동으로 정리합니다. 추출된 내용은 다음 단계에서 수정할 수 있습니다.</p>
              <div>
                <label className="block text-xs text-gray-600 mb-1">대상자 이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={seniorName}
                  onChange={(e) => setSeniorName(e.target.value)}
                  placeholder="예: 전대순"
                  className="w-full min-h-[40px] border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={"예: 2025년 7월 8일 상담. 전대순 어르신, 여성, 1935년 10월 15일생. 4등급. 고혈압, 당뇨 있으시고 담석증으로 수술 받음. 보호자는 큰아들 이현수 (010-8475-3336). 주 1~2회 왕래. 식사 도움 필요..."}
                rows={10}
                className="w-full border rounded-lg p-3 text-sm"
              />
              <button
                onClick={submitManual}
                disabled={!manualText.trim() || extracting}
                className="w-full min-h-[44px] bg-indigo-600 active:bg-indigo-800 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...</> : <><Upload className="w-4 h-4" /> 분석하기</>}
              </button>
              {err && <p className="text-sm text-red-600">{err}</p>}
            </section>
          )}

          {mode === "pdf" && (
            <section className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold">초기상담기록지 PDF 업로드</h2>
              </div>
              <p className="text-xs text-gray-500">이미 작성된 초기상담기록지 PDF가 있다면 올려주세요. AI가 내용을 추출합니다.</p>
              <label className="block">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                <span className="w-full min-h-[48px] border-2 border-dashed border-indigo-400 bg-indigo-50 active:bg-indigo-100 rounded-lg inline-flex items-center justify-center gap-2 px-3 py-2 cursor-pointer text-indigo-700 font-medium text-sm">
                  <FileText className="w-4 h-4" />
                  {file ? file.name : "PDF 파일 선택"}
                </span>
              </label>
              {file && (
                <p className="text-xs text-gray-500 text-center">선택됨 · {(file.size / 1024).toFixed(0)}KB</p>
              )}
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
        </>
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

      <RecordingDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="초기상담 녹음"
        uploadUrl="/api/intake-forms/from-audio"
        pathPrefix="intake"
        submitLabel="분석하기"
        onComplete={onRecordingComplete}
      />
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
