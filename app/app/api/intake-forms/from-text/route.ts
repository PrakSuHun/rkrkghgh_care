import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractIntakeFromText } from "@/lib/intakeExtractor";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  let extracted;
  try {
    extracted = await extractIntakeFromText(text);
  } catch (e: any) {
    const { data: row } = await supabase
      .from("intake_forms")
      .insert({ status: "failed", error_msg: e.message, source: "manual", manual_text: text })
      .select("*")
      .single();
    return NextResponse.json({ error: e.message, intake: row }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("intake_forms")
    .insert({
      source: "manual",
      manual_text: text,
      counseling_date: extracted.counseling_date ?? null,
      counselor_name: extracted.counselor_name ?? null,
      extracted_data: extracted,
      status: "extracted",
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ intake: inserted });
}
