import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("seniors")
    .select("*")
    .eq("status", "active")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, recipients: data, total: data?.length ?? 0 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("seniors")
    .insert({
      name: body.name,
      birth_date: body.birth_date ?? null,
      grade: body.care_level ?? body.grade ?? null,
      address: body.address ?? null,
      guardian_phone: body.guardian_phone ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
