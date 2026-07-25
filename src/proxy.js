import { NextResponse } from "next/server";

// Runs before routes render (this Next version's replacement for
// middleware). Three jobs:
// 1. Optional site-wide Basic Auth gate for staging deployments (below).
// 2. CSRF defense-in-depth: cross-origin browsers can't be stopped by
//    sameSite=lax alone in every case, so reject state-changing API
//    requests whose Origin doesn't match the host we're serving.
// 3. Gate /admin pages behind a session cookie. The role itself is
//    re-checked server-side in every admin API route — this redirect is
//    UX, not the security boundary.

// Constant-time-ish comparison so the gate doesn't leak credential
// prefixes through response timing.
function safeEqual(a, b) {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Site-wide Basic Auth, enabled only when BOTH env vars are set — use it
// to gate a staging/dev deployment behind a browser login popup. Leave
// the vars unset in production so the store stays public.
function basicAuthGate(request) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) return null;

  // Health stays open: Docker healthchecks and platform probes don't
  // send credentials, and it exposes nothing sensitive.
  if (request.nextUrl.pathname === "/api/health") return null;

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      const gotUser = decoded.slice(0, sep);
      const gotPassword = decoded.slice(sep + 1);
      // Bitwise & (not &&) so both halves are always compared.
      if (safeEqual(gotUser, user) & safeEqual(gotPassword, password)) {
        return null;
      }
    } catch {
      // Malformed base64 — fall through to the 401.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Barks-A-Lot Staging"' },
  });
}

export function proxy(request) {
  const denied = basicAuthGate(request);
  if (denied) return denied;

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

  // Auth.js prefixes its session cookie with __Secure- when served over
  // HTTPS in production.
  const hasSession =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");
  if (pathname.startsWith("/admin") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's static assets (hashed bundles — no content
  // worth gating, and skipping them keeps page loads fast).
  matcher: ["/((?!_next/static|_next/image|icon\\.ico).*)"],
};
