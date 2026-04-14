import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateMeeting, MEETING_TYPE_LABEL, MeetingType } from "@/lib/meetingGenerator";

export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("held_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meetings: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  const meetingType = body.meeting_type as MeetingType;
  if (!meetingType || !MEETING_TYPE_LABEL[meetingType]) {
    return NextResponse.json({ error: "meeting_type 필요" }, { status: 400 });
  }
  const heldAt = body.held_at || new Date().toISOString().slice(0, 10);
  const attendeeIds: number[] = Array.isArray(body.attendee_worker_ids) ? body.attendee_worker_ids : [];
  const relatedSeniorId: number | null = body.related_senior_id ?? null;
  const fromWorkerId: number | null = body.related_from_worker_id ?? null;
  const toWorkerId: number | null = body.related_to_worker_id ?? null;
  const topic: string | undefined = body.topic;

  const [attendeeRes, seniorRow, fromWorkerRow, toWorkerRow] = await Promise.all([
    attendeeIds.length
      ? supabase.from("caregivers").select("id, name").in("id", attendeeIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    relatedSeniorId
      ? supabase.from("seniors").select("name, grade, assess_summary").eq("id", relatedSeniorId).maybeSingle()
      : Promise.resolve({ data: null }),
    fromWorkerId
      ? supabase.from("caregivers").select("name").eq("id", fromWorkerId).maybeSingle()
      : Promise.resolve({ data: null }),
    toWorkerId
      ? supabase.from("caregivers").select("name").eq("id", toWorkerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const attendeeNames = (attendeeRes.data ?? []).map((w: any) => w.name);

  let seniorCtx: any = null;
  if (relatedSeniorId && seniorRow.data) {
    const { data: journals } = await supabase
      .from("journals")
      .select("summary, created_at")
      .eq("senior_id", relatedSeniorId)
      .not("summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);
    seniorCtx = {
      name: seniorRow.data.name,
      grade: seniorRow.data.grade,
      assessSummary: seniorRow.data.assess_summary,
      journals: (journals ?? []).map((j: any) => j.summary).filter(Boolean),
    };
  }

  let centerCtx: any = {};
  if (meetingType === "monthly_staff") {
    const monthStart = heldAt.slice(0, 7) + "-01";
    const [{ data: newSeniors }, { data: newWorkers }] = await Promise.all([
      supabase.from("seniors").select("name").gte("created_at", monthStart).eq("status", "active"),
      supabase.from("caregivers").select("name").gte("created_at", monthStart).eq("status", "active"),
    ]);
    centerCtx = {
      newSeniors: (newSeniors ?? []).map((r: any) => r.name),
      newWorkers: (newWorkers ?? []).map((r: any) => r.name),
    };
  }

  const gen = await generateMeeting({
    meetingType,
    heldAt,
    attendees: attendeeNames,
    topic,
    relatedSenior: seniorCtx,
    fromWorker: fromWorkerRow.data?.name,
    toWorker: toWorkerRow.data?.name,
    centerContext: centerCtx,
  });

  const { data: inserted, error } = await supabase
    .from("meetings")
    .insert({
      meeting_type: meetingType,
      title: body.title ?? MEETING_TYPE_LABEL[meetingType],
      held_at: heldAt,
      held_time: body.held_time ?? null,
      duration_min: body.duration_min ?? 60,
      location: body.location ?? "센터 사무실",
      attendee_worker_ids: attendeeIds,
      related_senior_id: relatedSeniorId,
      related_from_worker_id: fromWorkerId,
      related_to_worker_id: toWorkerId,
      topic: topic ?? null,
      agenda: gen.agenda,
      content: gen.content,
      decisions: gen.decisions,
      status: "done",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meeting: inserted });
}
