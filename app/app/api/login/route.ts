import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const APP_USER = process.env.APP_USER || "admin";
const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || APP_PASSWORD || "";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export async function POST(req: Request) {
  if (!APP_PASSWORD) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  const { user, pass } = await req.json();
  if (user !== APP_USER || pass !== APP_PASSWORD) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }
  const store = await cookies();
  store.set({
    name: "care_session",
    value: SESSION_SECRET,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete("care_session");
  return NextResponse.json({ ok: true });
}
