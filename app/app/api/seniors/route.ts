import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  const search = url.searchParams.get("search")?.trim();

  let q = supabase.from("seniors").select("*").order("name");
  if (status) q = q.eq("status", status);
  if (search) q = q.ilike("name", `%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((s) => s.id);
  const [{ data: assignments }, { data: lastJournals }] = await Promise.all([
    ids.length
      ? supabase
          .from("caregiver_assignments")
          .select("senior_id, caregivers(name)")
          .in("senior_id", ids)
          .eq("status", "active")
      : Promise.resolve({ data: [] as any[] }),
    ids.length
      ? supabase
          .from("journals")
          .select("senior_id, created_at")
          .in("senior_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const cgMap = new Map<number, string[]>();
  for (const a of (assignments ?? []) as any[]) {
    if (!cgMap.has(a.senior_id)) cgMap.set(a.senior_id, []);
    if (a.caregivers?.name) cgMap.get(a.senior_id)!.push(a.caregivers.name);
  }
  const lastJ = new Map<number, string>();
  for (const j of (lastJournals ?? []) as any[]) {
    if (!lastJ.has(j.senior_id)) lastJ.set(j.senior_id, j.created_at);
  }

  const enriched = (data ?? []).map((s) => ({
    ...s,
    caregiver_names: cgMap.get(s.id) ?? [],
    active_assignment_count: cgMap.get(s.id)?.length ?? 0,
    last_journal_at: lastJ.get(s.id) ?? null,
  }));

  return NextResponse.json({
    data: enriched,
    recipients: enriched, // legacy alias
    total: enriched.length,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("seniors")
    .insert({
      name: body.name,
      birth_date: body.birth_date ?? null,
      grade: body.grade ?? body.care_level ?? null,
      long_term_care_id: body.long_term_care_id ?? null,
      address: body.address ?? null,
      address_type: body.address_type ?? null,
      guardian_name: body.guardian_name ?? null,
      guardian_relation: body.guardian_relation ?? null,
      guardian_phone: body.guardian_phone ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
