import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

function generateConfirmationNumber() {
  return `BAL-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: auth.userId },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(req) {
  const auth = await getAuthUser();

  try {
    const { items, address, city, state, zip, guestEmail, guestName } = await req.json();

    if (!items?.length || !address || !city || !state || !zip) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Guest orders have no account, so an email is required to reference
    // the order later.
    if (!auth && !guestEmail) {
      return NextResponse.json(
        { error: "Email is required for guest checkout" },
        { status: 400 }
      );
    }

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = {};
    for (const p of products) {
      productMap[p.id] = p;
    }

    let total = 0;
    const orderItems = items.map((item) => {
      const product = productMap[item.productId];
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      };
    });

    const order = await prisma.order.create({
      data: {
        userId: auth?.userId ?? null,
        guestEmail: auth ? null : guestEmail,
        guestName: auth ? null : guestName || null,
        confirmationNumber: generateConfirmationNumber(),
        total,
        address,
        city,
        state,
        zip,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } } },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
