import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const monthParam = z.string().regex(/^\d{4}-\d{2}$/);
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Public, read-only. ?month=YYYY-MM returns a month of events for the
// calendar; ?date=YYYY-MM-DD returns one day for the details page.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const date = searchParams.get("date");

  let where = {};
  if (date && dateParam.safeParse(date).success) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    where = { date: { gte: start, lt: end } };
  } else if (month && monthParam.safeParse(month).success) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    where = { date: { gte: start, lt: end } };
  } else {
    return NextResponse.json(
      { error: "Provide ?month=YYYY-MM or ?date=YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ events });
}
