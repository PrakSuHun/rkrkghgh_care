import { NextRequest, NextResponse } from "next/server";

const APP_PASSWORD = process.env.APP_PASSWORD;
const RAW_SECRET = process.env.SESSION_SECRET || APP_PASSWORD || "";
// 특수문자 안전한 토큰으로 변환 (양쪽 동일 알고리즘)
const SESSION_TOKEN = RAW_SECRET
  ? Buffer.from(RAW_SECRET, "utf8").toString("base64").replace(/=+$/, "")
  : "";
const EXTENSION_SECRET = process.env.EXTENSION_SECRET;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 크롬 확장 전용
  if (pathname.startsWith("/api/tags")) {
    if (req.method === "OPTIONS") return NextResponse.next();
    if (!EXTENSION_SECRET) return json(401, { error: "unauthorized" });
    const sent = req.headers.get("x-extension-secret");
    if (sent !== EXTENSION_SECRET) return json(401, { error: "unauthorized" });
    return NextResponse.next();
  }

  // 로그인 엔드포인트는 통과
  if (pathname === "/api/login" || pathname === "/login") {
    return NextResponse.next();
  }

  // 세션 쿠키 검사
  const session = req.cookies.get("care_session")?.value;
  const ok = SESSION_TOKEN && session === SESSION_TOKEN;

  if (!ok) {
    if (pathname.startsWith("/api/")) return json(401, { error: "unauthorized" });
    // 페이지는 /login으로 리다이렉트
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|robots).*)"],
};
