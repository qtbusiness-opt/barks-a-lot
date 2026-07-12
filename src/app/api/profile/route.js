import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const nameSchema = z.object({ name: z.string().trim().min(1).max(100) });

const addressKey = (a) =>
  [a.address, a.city, a.state, a.zip].map((s) => s.trim().toLowerCase()).join("|");

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Import any shipping addresses from order history that aren't in the
  // address book yet, so "addresses you've used" is always complete even
  // for orders placed before the book existed.
  const [book, shippedOrders, statusGroups] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { userId: user.id, fulfillmentType: "shipping", address: { not: null } },
      select: { address: true, city: true, state: true, zip: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const known = new Set(book.map(addressKey));
  const toImport = [];
  for (const o of shippedOrders) {
    const key = addressKey(o);
    if (!known.has(key)) {
      known.add(key);
      toImport.push({
        userId: user.id,
        address: o.address,
        city: o.city,
        state: o.state,
        zip: o.zip,
      });
    }
  }
  if (toImport.length > 0) {
    await prisma.address.createMany({ data: toImport });
  }

  const addresses =
    toImport.length > 0
      ? await prisma.address.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        })
      : book;

  const counts = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all])
  );

  return NextResponse.json({
    user,
    addresses,
    orderSummary: {
      pending: counts.pending ?? 0,
      shipped: counts.shipped ?? 0,
      delivered: counts.delivered ?? 0,
      cancelled: counts.cancelled ?? 0,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    },
  });
}

export async function PATCH(req) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = nameSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a name" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[profile] update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
