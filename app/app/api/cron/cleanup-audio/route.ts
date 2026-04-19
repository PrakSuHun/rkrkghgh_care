import { NextResponse } from "next/server";
import { supabase, AUDIO_BUCKET } from "@/lib/supabase";

export const maxDuration = 300;

// 하루(24시간) 지난 녹음 파일과 관련 intake_forms.audio_path 참조 정리
// Vercel Cron (매일 03:00 KST = 18:00 UTC) 또는 수동 호출 가능
// 보호: CRON_SECRET 환경변수가 설정돼 있으면 Authorization: Bearer <secret> 필수
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const deletedPaths: string[] = [];
  const failures: { path: string; error: string }[] = [];

  // 1) audio 버킷의 모든 파일 나열 (최대 1000개씩 페이지네이션)
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data: list, error } = await supabase.storage.from(AUDIO_BUCKET).list("", {
      limit,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) {
      return NextResponse.json({ error: `list error: ${error.message}` }, { status: 500 });
    }
    if (!list || list.length === 0) break;

    const toDelete = list
      .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoffMs)
      .map((f) => f.name);

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.storage.from(AUDIO_BUCKET).remove(toDelete);
      if (delErr) {
        for (const p of toDelete) failures.push({ path: p, error: delErr.message });
      } else {
        deletedPaths.push(...toDelete);
      }
    }

    if (list.length < limit) break;
    offset += limit;
  }

  // 2) intake_forms 의 audio_path 참조를 null 로 정리 (삭제된 파일 기준)
  let intakeCleared = 0;
  if (deletedPaths.length > 0) {
    const { data: intakeRows, error: intakeErr } = await supabase
      .from("intake_forms")
      .update({ audio_path: null })
      .in("audio_path", deletedPaths)
      .select("id");
    if (!intakeErr && intakeRows) intakeCleared = intakeRows.length;
  }

  // 3) journals 의 audio_path 도 동일하게 (필드가 존재할 때만)
  let journalsCleared = 0;
  if (deletedPaths.length > 0) {
    try {
      const { data: jrRows } = await supabase
        .from("journals")
        .update({ audio_path: null })
        .in("audio_path", deletedPaths)
        .select("id");
      if (jrRows) journalsCleared = jrRows.length;
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    cutoff: cutoffIso,
    deleted_count: deletedPaths.length,
    deleted_paths: deletedPaths,
    intake_refs_cleared: intakeCleared,
    journal_refs_cleared: journalsCleared,
    failures,
  });
}
