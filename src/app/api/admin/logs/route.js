import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Activity log for the admin dashboard: a summary breakdown plus a
// filterable list of recent events (logins + errors).
export async function GET(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category"); // "auth" | "error" | null
  const event = searchParams.get("event"); // exact event, optional

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const where = {};
  if (category) where.category = category;
  if (event) where.event = event;

  const [events, byEvent24h, loginsToday, failedToday, errorsToday, totalWeek] =
    await Promise.all([
      prisma.logEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      // Breakdown of events in the last 24h.
      prisma.logEvent.groupBy({
        by: ["event"],
        where: { createdAt: { gte: dayAgo } },
        _count: { _all: true },
      }),
      prisma.logEvent.count({
        where: { event: "login_success", createdAt: { gte: dayAgo } },
      }),
      prisma.logEvent.count({
        where: { event: "login_failed", createdAt: { gte: dayAgo } },
      }),
      prisma.logEvent.count({
        where: { category: "error", createdAt: { gte: dayAgo } },
      }),
      prisma.logEvent.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

  const breakdown = Object.fromEntries(
    byEvent24h.map((g) => [g.event, g._count._all])
  );

  return NextResponse.json({
    events,
    summary: {
      loginsToday,
      failedToday,
      errorsToday,
      totalWeek,
      breakdown,
    },
  });
}
