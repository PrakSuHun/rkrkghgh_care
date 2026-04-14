import { NextResponse } from "next/server";
import { refineDocument } from "@/lib/docGenerator";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.doc || !body.instruction) {
    return NextResponse.json({ error: "doc과 instruction 필요" }, { status: 400 });
  }
  try {
    const doc = await refineDocument(body.doc, String(body.instruction));
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
