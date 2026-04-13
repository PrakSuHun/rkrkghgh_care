import { NextRequest, NextResponse } from "next/server";

const APP_USER = process.env.APP_USER || "admin";
const APP_PASSWORD = process.env.APP_PASSWORD;
const EXTENSION_SECRET = process.env.EXTENSION_SECRET;

function unauthorized(basic = false) {
  const headers = new Headers();
  if (basic) headers.set("WWW-Authenticate", 'Basic realm="care", charset="UTF-8"');
  return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers,
  });
}

function decodeBasic(header: string | null): { user: string; pass: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 크롬 확장 전용
  if (pathname.startsWith("/api/tags")) {
    if (req.method === "OPTIONS") return NextResponse.next();
    if (!EXTENSION_SECRET) return unauthorized();
    const sent = req.headers.get("x-extension-secret");
    if (sent !== EXTENSION_SECRET) return unauthorized();
    return NextResponse.next();
  }

  // 그 외 전부 HTTP Basic 인증
  if (!APP_PASSWORD) return unauthorized(true);
  const creds = decodeBasic(req.headers.get("authorization"));
  if (!creds || creds.user !== APP_USER || creds.pass !== APP_PASSWORD) {
    return unauthorized(true);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|robots).*)"],
};
