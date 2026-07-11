import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(2000),
});

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ announcements });
}

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = announcementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Announcements need a title and a message" },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: { ...parsed.data, createdBy: auth.userId },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (err) {
    console.error("[admin] announcement create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
