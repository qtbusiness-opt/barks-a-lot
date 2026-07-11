import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: the latest announcement, shown as a banner on the storefront.
export async function GET() {
  const announcement = await prisma.announcement.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, createdAt: true },
  });

  return NextResponse.json({ announcement });
}
