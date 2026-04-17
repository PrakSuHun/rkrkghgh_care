import { NextResponse } from "next/server";
import { generateDocument, DocType, DOC_TYPE_LABEL } from "@/lib/docGenerator";

export const maxDuration = 120;

const NEEDS: Record<DocType, { senior?: boolean; worker?: boolean; month?: boolean }> = {
  needs_assessment: { senior: true },
  senior_handover: { senior: true },
  monthly_work_report: { senior: true, month: true },
};

export async function POST(req: Request) {
  const body = await req.json();
  const type = body.type as DocType;
  if (!type || !DOC_TYPE_LABEL[type]) {
    return NextResponse.json({ error: "type 필요" }, { status: 400 });
  }
  const need = NEEDS[type];
  if (need.senior && !body.senior_id) return NextResponse.json({ error: "senior_id 필요" }, { status: 400 });
  if (need.worker && !body.worker_id) return NextResponse.json({ error: "worker_id 필요" }, { status: 400 });
  if (need.month && !/^\d{4}-\d{2}$/.test(String(body.month ?? ""))) {
    return NextResponse.json({ error: "month(YYYY-MM) 필요" }, { status: 400 });
  }
  try {
    const doc = await generateDocument(type, {
      seniorId: body.senior_id ? Number(body.senior_id) : undefined,
      workerId: body.worker_id ? Number(body.worker_id) : undefined,
      month: body.month,
      fromWorkerId: body.from_worker_id ? Number(body.from_worker_id) : undefined,
      toWorkerId: body.to_worker_id ? Number(body.to_worker_id) : undefined,
      userPrompt: body.user_prompt,
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
