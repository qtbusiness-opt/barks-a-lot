import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { EVENT_COLOR_KEYS } from "@/lib/event-colors";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  location: z.string().trim().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  color: z.enum(EVENT_COLOR_KEYS).default("teal"),
});

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = eventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fill out the event fields correctly" },
        { status: 400 }
      );
    }
    const { date, location, ...rest } = parsed.data;

    const event = await prisma.event.create({
      data: {
        ...rest,
        location: location || null,
        date: new Date(`${date}T00:00:00.000Z`),
      },
    });

    console.info(`[admin] event created id=${event.id} by=${auth.userId}`);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error("[admin] event create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
