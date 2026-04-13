import { NextResponse } from "next/server";

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
  const res = NextResponse.json({ ok: true });
  res.cookies.set("care_session", SESSION_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("care_session");
  return res;
}
