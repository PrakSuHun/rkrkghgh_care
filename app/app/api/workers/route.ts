import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("caregivers")
    .select("*")
    .eq("status", "active")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, caregivers: data, total: data?.length ?? 0 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("caregivers")
    .insert({
      name: body.name,
      phone: body.phone ?? null,
      license_number: body.license_number ?? null,
      hire_date: body.hire_date ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
