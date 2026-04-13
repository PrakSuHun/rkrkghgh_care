import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seniorId = url.searchParams.get("senior_id");
  const caregiverId = url.searchParams.get("caregiver_id");
  const status = url.searchParams.get("status") ?? "active";

  let q = supabase
    .from("caregiver_assignments")
    .select("*, seniors(name), caregivers(name, phone)")
    .order("start_date", { ascending: false });
  if (seniorId) q = q.eq("senior_id", seniorId);
  if (caregiverId) q = q.eq("caregiver_id", caregiverId);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: data?.length ?? 0 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("caregiver_assignments")
    .insert({
      senior_id: body.senior_id,
      caregiver_id: body.caregiver_id,
      role: body.role ?? "primary",
      start_date: body.start_date,
      end_date: body.end_date ?? null,
      weekly_pattern: body.weekly_pattern ?? [],
      status: "active",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
