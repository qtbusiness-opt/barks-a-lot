import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ?archived=true lists archived notifications; default is the active
  // (un-archived) list.
  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";

  const notifications = await prisma.notification.findMany({
    where: { archivedAt: archived ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ notifications });
}
