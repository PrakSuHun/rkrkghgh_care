"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { invalidate } from "@/lib/swr";

export default function NewWorkerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim()) { setErr("이름은 필수입니다"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/workers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "등록 실패");
      invalidate("/api/workers");
      router.push(`/workers/${j.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:p-6 max-w-xl mx-auto space-y-4">
      <Link href="/workers" className="inline-flex items-center text-sm text-gray-600 active:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
      </Link>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-green-600" />
          <h1 className="text-lg font-bold">요양보호사 등록</h1>
        </div>
        <p className="text-xs text-gray-500">이름과 휴대폰번호만 있으면 바로 등록됩니다. 나머지 정보는 나중에 보완할 수 있어요.</p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">이름 <span className="text-red-500">*</span></span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              className="mt-1 w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">휴대폰번호</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예: 010-1234-5678"
              className="mt-1 w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="w-full min-h-[48px] bg-green-600 active:bg-green-800 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> 등록 중...</> : "등록"}
        </button>
      </div>
    </div>
  );
}
