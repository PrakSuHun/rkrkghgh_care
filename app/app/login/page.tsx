"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
    setLoading(false);
    if (res.ok) router.replace(next);
    else setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
    >
      <h1 className="text-xl font-semibold text-center">로그인</h1>
      <input
        type="text"
        inputMode="text"
        autoComplete="username"
        placeholder="아이디"
        value={user}
        onChange={(e) => setUser(e.target.value)}
        className="w-full border rounded-lg px-3 py-2"
        required
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        className="w-full border rounded-lg px-3 py-2"
        required
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg py-2 disabled:opacity-50"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<div className="w-full max-w-sm bg-white rounded-xl shadow p-6">로딩 중...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
