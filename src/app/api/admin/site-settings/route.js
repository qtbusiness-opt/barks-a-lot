import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  ALLOWED_SETTING_KEYS,
  PICKUP_HOURS_START,
  PICKUP_HOURS_END,
  getSettings,
} from "@/lib/site-settings";
import { isSlotTime } from "@/lib/calendar-days";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await getSettings([...ALLOWED_SETTING_KEYS]);
  return NextResponse.json({ settings });
}

const patchSchema = z.object({
  key: z.string().min(1),
  // Empty string clears the setting (revert to the placeholder).
  value: z.string().trim().max(500),
});

export async function PATCH(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { key, value } = parsed.data;
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
    }

    // Pickup hours are times on the half hour (or cleared, for the
    // default) — anything else would leave checkout with odd slots.
    if (
      (key === PICKUP_HOURS_START || key === PICKUP_HOURS_END) &&
      value !== "" &&
      !isSlotTime(value)
    ) {
      return NextResponse.json(
        { error: "Pickup hours must be on the hour or half hour" },
        { status: 400 }
      );
    }

    if (value === "") {
      await prisma.siteSetting.deleteMany({ where: { key } });
    } else {
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ key, value });
  } catch (err) {
    console.error("[admin] site-setting update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
