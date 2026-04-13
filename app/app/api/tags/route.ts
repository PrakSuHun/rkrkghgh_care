import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const { data, error } = await supabase
    .from("tag_records")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(200);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json(
    { records: data, total: data?.length ?? 0 },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const records = body.records ?? [];
  const url = body.url ?? "";

  if (!records.length) {
    return NextResponse.json({ saved: 0, total: 0 }, { headers: CORS_HEADERS });
  }

  const rows = records.map((r: unknown) => ({ raw_data: r, source_url: url }));
  const { error } = await supabase.from("tag_records").insert(rows);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  return NextResponse.json(
    { saved: rows.length, total: records.length },
    { headers: CORS_HEADERS }
  );
}
