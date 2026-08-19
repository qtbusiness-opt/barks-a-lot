import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import pkg from "../../../../package.json" with { type: "json" };

// Used by the Docker healthcheck: verifies the app can serve requests AND
// reach its database, not merely that the process started. Also lets you
// confirm which release Cloud Run is actually running without opening
// the admin UI — see also the footer in AdminShell. The version number
// carries no CVE surface for a bespoke app like this one, so it staying
// public (this route is exempt from the Basic Auth gate — see
// src/proxy.js) is a deliberate, low-risk call, not an oversight.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", version: pkg.version });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", version: pkg.version },
      { status: 503 }
    );
  }
}
