import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const seniorId = Number(body.senior_id);
  const content = String(body.content ?? "").trim();
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));

  if (!seniorId) return NextResponse.json({ error: "대상자 필요" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "내용을 입력해주세요" }, { status: 400 });

  const { data, error } = await supabase
    .from("journals")
    .insert({
      senior_id: seniorId,
      summary: content,
      transcript: content,
      duration: 0,
      audio_url: "",
      status: "done",
      created_at: new Date(`${date}T09:00:00`).toISOString(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
