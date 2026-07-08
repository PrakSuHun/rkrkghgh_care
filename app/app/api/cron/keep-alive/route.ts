import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Supabase 무료 플랜은 7일간 요청이 없으면 프로젝트를 자동 일시정지시킨다.
// 매일 가벼운 쿼리를 한 번 날려 유휴 타이머를 리셋 → 자동 일시정지 방지.
// Vercel Cron (매일 00:00 UTC = 09:00 KST) 또는 수동 호출 가능.
// 보호: CRON_SECRET 이 설정돼 있으면 Authorization: Bearer <secret> 필수.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 가장 가벼운 형태의 실제 DB 요청 (행을 읽지 않고 카운트 헤더만 요청)
  const { error, count } = await supabase
    .from("seniors")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, pinged: "seniors", count: count ?? 0 });
}
