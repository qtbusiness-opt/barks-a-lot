import { NextResponse } from "next/server";

// Runs before routes render (this Next version's replacement for
// middleware). Two jobs:
// 1. CSRF defense-in-depth: cross-origin browsers can't be stopped by
//    sameSite=lax alone in every case, so reject state-changing API
//    requests whose Origin doesn't match the host we're serving.
// 2. Gate /admin pages behind a session cookie. The role itself is
//    re-checked server-side in every admin API route — this redirect is
//    UX, not the security boundary.
export function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (
    pathname.startsWith("/api/") &&
    ["POST", "PATCH", "PUT", "DELETE"].includes(method)
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/admin") && !request.cookies.get("token")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
