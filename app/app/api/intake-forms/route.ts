import { NextResponse } from "next/server";
import { supabase, INTAKE_BUCKET } from "@/lib/supabase";
import { extractIntakeFromPDF } from "@/lib/intakeExtractor";

export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seniorId = url.searchParams.get("senior_id");
  let q = supabase.from("intake_forms").select("*").order("created_at", { ascending: false });
  if (seniorId) q = q.eq("senior_id", Number(seniorId)).limit(1);
  else q = q.limit(50);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ intakes: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  const pdfPath = String(body.pdf_path ?? "");
  if (!pdfPath) return NextResponse.json({ error: "pdf_path required" }, { status: 400 });

  const { data: file, error: dlErr } = await supabase.storage.from(INTAKE_BUCKET).download(pdfPath);
  if (dlErr || !file) return NextResponse.json({ error: dlErr?.message ?? "PDF not found" }, { status: 404 });
  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted;
  try {
    extracted = await extractIntakeFromPDF(buffer);
  } catch (e: any) {
    const { data: row } = await supabase
      .from("intake_forms")
      .insert({ pdf_path: pdfPath, status: "failed", error_msg: e.message })
      .select("*")
      .single();
    return NextResponse.json({ error: e.message, intake: row }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("intake_forms")
    .insert({
      pdf_path: pdfPath,
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
