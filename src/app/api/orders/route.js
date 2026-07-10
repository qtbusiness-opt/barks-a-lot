import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

function generateConfirmationNumber() {
  return `BAL-${randomBytes(5).toString("hex").toUpperCase()}`;
}

const orderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().min(1).max(100),
        })
      )
      .min(1),
    fulfillmentType: z.enum(["shipping", "pickup"]).default("shipping"),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(50).optional(),
    zip: z.string().trim().max(20).optional(),
    guestEmail: z.email().optional(),
    guestName: z.string().trim().max(100).optional(),
  })
  .refine(
    // Pickup orders (collected at a market/event) need no address.
    (o) =>
      o.fulfillmentType === "pickup" ||
      (o.address && o.city && o.state && o.zip),
    { message: "Shipping orders require a full address" }
  );

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
  if (!rateLimit("checkout", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  const auth = await getAuthUser();

  try {
    const parsed = orderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check your order details and try again" },
        { status: 400 }
      );
    }
    const { items, fulfillmentType, address, city, state, zip, guestEmail, guestName } =
      parsed.data;

    // Guest orders have no account, so an email is required to reference
    // the order later.
    if (!auth && !guestEmail) {
      return NextResponse.json(
        { error: "Email is required for guest checkout" },
        { status: 400 }
      );
    }

    // Price and stock are verified server-side inside one transaction:
    // the stock check, decrement, and order creation succeed or fail
    // together so concurrent checkouts can't oversell.
    const order = await prisma.$transaction(async (tx) => {
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = {};
      for (const p of products) productMap[p.id] = p;

      let total = 0;
      const orderItems = [];
      for (const item of items) {
        const product = productMap[item.productId];
        if (!product) {
          throw Object.assign(new Error("Product not found"), { code: 404 });
        }
        if (!product.inStock || product.quantity < item.quantity) {
          throw Object.assign(
            new Error(`Not enough stock for ${product.name}`),
            { code: 409 }
          );
        }
        total += product.price * item.quantity;
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }

      for (const item of items) {
        const remaining = productMap[item.productId].quantity - item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: remaining, inStock: remaining > 0 },
        });
      }

      return tx.order.create({
        data: {
          userId: auth?.userId ?? null,
          guestEmail: auth ? null : guestEmail,
          guestName: auth ? null : guestName || null,
          confirmationNumber: generateConfirmationNumber(),
          channel: "online",
          fulfillmentType,
          total,
          address: address ?? null,
          city: city ?? null,
          state: state ?? null,
          zip: zip ?? null,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } } },
      });
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err.code === 409 || err.code === 404) {
      return NextResponse.json({ error: err.message }, { status: err.code });
    }
    console.error("[orders] create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
