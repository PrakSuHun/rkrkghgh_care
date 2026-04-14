import { NextResponse } from "next/server";
import { generateDocument, DocType, DOC_TYPE_LABEL } from "@/lib/docGenerator";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const type = body.type as DocType;
  if (!type || !DOC_TYPE_LABEL[type]) {
    return NextResponse.json({ error: "type 필요" }, { status: 400 });
  }
  try {
    const doc = await generateDocument(type, {
      seniorId: body.senior_id ? Number(body.senior_id) : undefined,
      workerId: body.worker_id ? Number(body.worker_id) : undefined,
      month: body.month,
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
