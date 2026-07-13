import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const addressSchema = z.object({
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(50),
  zip: z.string().trim().min(1).max(20),
});

// Ownership is part of the where clause on every operation — one user's
// address id is a 404 for anyone else.
export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const parsed = addressSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fill out the full address" },
        { status: 400 }
      );
    }

    const { count } = await prisma.address.updateMany({
      where: { id, userId: auth.userId },
      data: parsed.data,
    });
    if (count === 0) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const address = await prisma.address.findUnique({ where: { id } });
    return NextResponse.json({ address });
  } catch (err) {
    console.error("[profile] address update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { count } = await prisma.address.deleteMany({
    where: { id, userId: auth.userId },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
