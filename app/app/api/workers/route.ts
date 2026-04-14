import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  const search = url.searchParams.get("search")?.trim();

  let q = supabase.from("caregivers").select("*").order("name");
  if (status) q = q.eq("status", status);
  if (search) q = q.ilike("name", `%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((c) => c.id);
  const [{ data: assignments }, { data: lastLogs }] = await Promise.all([
    ids.length
      ? supabase
          .from("caregiver_assignments")
          .select("caregiver_id, seniors(name)")
          .in("caregiver_id", ids)
          .eq("status", "active")
      : Promise.resolve({ data: [] as any[] }),
    ids.length
      ? supabase
          .from("counseling_logs")
          .select("caregiver_id, created_at")
          .in("caregiver_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const nameMap = new Map<number, string[]>();
  for (const a of (assignments ?? []) as any[]) {
    if (!nameMap.has(a.caregiver_id)) nameMap.set(a.caregiver_id, []);
    if (a.seniors?.name) nameMap.get(a.caregiver_id)!.push(a.seniors.name);
  }
  const lastMap = new Map<number, string>();
  for (const l of (lastLogs ?? []) as any[]) {
    if (!lastMap.has(l.caregiver_id)) lastMap.set(l.caregiver_id, l.created_at);
  }

  const enriched = (data ?? []).map((c) => ({
    ...c,
    senior_names: nameMap.get(c.id) ?? [],
    activeRecipientCount: nameMap.get(c.id)?.length ?? 0,
    lastCounselingDate: lastMap.get(c.id) ?? null,
  }));

  return NextResponse.json({ data: enriched, caregivers: enriched, total: enriched.length });
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
