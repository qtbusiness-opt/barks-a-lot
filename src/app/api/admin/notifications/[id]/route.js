import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const patchSchema = z.object({ archived: z.boolean() });

// Archive / unarchive a customer notification from the admin list.
export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { archivedAt: parsed.data.archived ? new Date() : null },
    });

    return NextResponse.json({ notification });
  } catch {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
}
