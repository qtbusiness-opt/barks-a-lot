import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { EVENT_COLOR_KEYS } from "@/lib/event-colors";

// "" from a cleared <input type="time"> means "remove the time".
const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .or(z.literal(""))
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: timeField,
    endTime: timeField,
    color: z.enum(EVENT_COLOR_KEYS).optional(),
  })
  .refine((e) => !e.startTime || !e.endTime || e.startTime < e.endTime, {
    message: "The event must end after it starts",
  });

export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the event fields and try again" },
        { status: 400 }
      );
    }
    const { date, location, startTime, endTime, ...rest } = parsed.data;

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(location !== undefined ? { location: location || null } : {}),
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
        ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}),
      },
    });

    return NextResponse.json({ event });
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

export async function DELETE(_req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}
