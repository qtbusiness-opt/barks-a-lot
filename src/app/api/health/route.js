import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Used by the Docker healthcheck: verifies the app can serve requests AND
// reach its database, not merely that the process started.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
