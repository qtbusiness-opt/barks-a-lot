import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isWithinWindow } from "@/lib/catalog";
import { sendOrderConfirmationEmail } from "@/lib/order-emails";
import { SHIPPING_ENABLED } from "@/lib/features";
import { restockOrderItems } from "@/lib/inventory";
import {
  isPaymentConfigured,
  chargePayment,
  PaymentError,
} from "@/lib/payments";

function generateConfirmationNumber() {
  return `BAL-${randomBytes(5).toString("hex").toUpperCase()}`;
}

const orderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().min(1).optional(),
          quantity: z.number().int().min(1).max(100),
        })
      )
      .min(1),
    fulfillmentType: z
      .enum(["shipping", "pickup"])
      .default(SHIPPING_ENABLED ? "shipping" : "pickup"),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(50).optional(),
    zip: z.string().trim().max(20).optional(),
    guestEmail: z.email().optional(),
    guestName: z.string().trim().max(100).optional(),
    // Event id, or "next" for the nearest upcoming event that isn't today.
    pickupEventId: z.string().min(1).optional(),
    // Square card token from the Web Payments SDK. Required when payments
    // are configured; ignored otherwise (dev/tests without a Square token).
    paymentToken: z.string().min(1).max(500).optional(),
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
    include: {
      items: { include: { product: true, variant: true } },
      pickupEvent: true,
    },
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
    const {
      items,
      fulfillmentType,
      address,
      city,
      state,
      zip,
      guestEmail,
      guestName,
      pickupEventId,
      paymentToken,
    } = parsed.data;

    // With Square configured, no order is created without a card token.
    if (isPaymentConfigured() && !paymentToken) {
      return NextResponse.json(
        { error: "Please enter your card details to place the order" },
        { status: 400 }
      );
    }

    // Pickup-only launch: the shipping path stays in the codebase but is
    // refused until SHIPPING_ENABLED is flipped back on.
    if (!SHIPPING_ENABLED && fulfillmentType === "shipping") {
      return NextResponse.json(
        { error: "Shipping isn't available yet — please choose event pickup" },
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

    // Pickup orders are tied to a specific market/expo. "next" resolves
    // to the nearest upcoming event that is not today.
    let pickupEvent = null;
    if (fulfillmentType === "pickup") {
      if (!pickupEventId) {
        return NextResponse.json(
          { error: "Please choose a pickup event" },
          { status: 400 }
        );
      }
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      if (pickupEventId === "next") {
        const startOfTomorrow = new Date(
          startOfToday.getTime() + 24 * 60 * 60 * 1000
        );
        pickupEvent = await prisma.event.findFirst({
          where: { date: { gte: startOfTomorrow } },
          orderBy: { date: "asc" },
        });
        if (!pickupEvent) {
          return NextResponse.json(
            {
              error:
                "There are no upcoming events to assign — please pick a specific event",
            },
            { status: 409 }
          );
        }
      } else {
        pickupEvent = await prisma.event.findUnique({
          where: { id: pickupEventId },
        });
        if (!pickupEvent || pickupEvent.date < startOfToday) {
          return NextResponse.json(
            { error: "That event isn't available for pickup" },
            { status: 409 }
          );
        }
      }
    }

    // Price, availability, and stock are verified server-side inside one
    // transaction: the stock check, decrement, and order creation succeed
    // or fail together so concurrent checkouts can't oversell.
    const order = await prisma.$transaction(async (tx) => {
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { variants: true },
      });
      const productMap = {};
      for (const p of products) productMap[p.id] = p;

      const fail = (code, message) =>
        Object.assign(new Error(message), { code });

      let total = 0;
      const orderItems = [];
      // Track per-product/variant decrements before applying them, so a
      // failure on any line item aborts the whole transaction untouched.
      const decrements = [];

      for (const item of items) {
        const product = productMap[item.productId];
        if (!product) throw fail(404, "Product not found");
        if (!isWithinWindow(product)) {
          throw fail(409, `${product.name} is not currently available`);
        }

        if (product.variants.length > 0) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          if (!variant) {
            throw fail(400, `Please choose an option for ${product.name}`);
          }
          if (variant.quantity < item.quantity) {
            throw fail(
              409,
              `Not enough stock for ${product.name} (${variant.name})`
            );
          }
          const price = variant.price ?? product.price;
          total += price * item.quantity;
          orderItems.push({
            productId: product.id,
            variantId: variant.id,
            quantity: item.quantity,
            price,
          });
          decrements.push({ product, variant, quantity: item.quantity });
        } else {
          if (!product.inStock || product.quantity < item.quantity) {
            throw fail(409, `Not enough stock for ${product.name}`);
          }
          total += product.price * item.quantity;
          orderItems.push({
            productId: product.id,
            quantity: item.quantity,
            price: product.price,
          });
          decrements.push({ product, quantity: item.quantity });
        }
      }

      for (const { product, variant, quantity } of decrements) {
        if (variant) {
          const remaining = variant.quantity - quantity;
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { quantity: remaining },
          });
          variant.quantity = remaining;
          const anyLeft = product.variants.some((v) => v.quantity > 0);
          await tx.product.update({
            where: { id: product.id },
            data: { inStock: anyLeft },
          });
        } else {
          const remaining = product.quantity - quantity;
          await tx.product.update({
            where: { id: product.id },
            data: { quantity: remaining, inStock: remaining > 0 },
          });
          product.quantity = remaining;
        }
      }

      return tx.order.create({
        data: {
          userId: auth?.userId ?? null,
          guestEmail: auth ? null : guestEmail,
          guestName: auth ? null : guestName || null,
          confirmationNumber: generateConfirmationNumber(),
          channel: "online",
          fulfillmentType,
          pickupEventId: pickupEvent?.id ?? null,
          total,
          // Only shipping orders record an address — pickup orders never
          // need one, even if the client sends it.
          address: fulfillmentType === "shipping" ? address : null,
          city: fulfillmentType === "shipping" ? city : null,
          state: fulfillmentType === "shipping" ? state : null,
          zip: fulfillmentType === "shipping" ? zip : null,
          items: { create: orderItems },
        },
        include: {
          items: { include: { product: true, variant: true } },
          pickupEvent: true,
          // The confirmation email pulls the recipient from order.user
          // for account holders (guests use guestEmail).
          user: { select: { name: true, email: true } },
        },
      });
    });

    // Charge the tokenized card for the server-computed total. If the
    // charge fails, undo the order (restock + delete) so a declined card
    // never holds inventory — the DB work and the charge succeed or fail
    // as a pair.
    if (isPaymentConfigured()) {
      try {
        const payment = await chargePayment({
          sourceId: paymentToken,
          amountCents: Math.round(order.total * 100),
          note: `Barks-A-Lot order ${order.confirmationNumber}`,
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentId: payment.id },
        });
        order.paymentId = payment.id;
      } catch (err) {
        await prisma.$transaction(async (tx) => {
          await restockOrderItems(tx, order.items);
          await tx.orderItem.deleteMany({ where: { orderId: order.id } });
          await tx.order.delete({ where: { id: order.id } });
        });
        if (err instanceof PaymentError) {
          return NextResponse.json({ error: err.message }, { status: 402 });
        }
        throw err;
      }
    }

    // Remember this shipping address in the customer's address book
    // (deduplicated; guests have no book). Dormant while pickup-only.
    if (SHIPPING_ENABLED && auth && fulfillmentType === "shipping") {
      const existing = await prisma.address.findFirst({
        where: { userId: auth.userId, address, city, state, zip },
      });
      if (!existing) {
        await prisma.address.create({
          data: { userId: auth.userId, address, city, state, zip },
        });
      }
    }

    // Fire-and-forget: a mail hiccup must never fail a placed order.
    await sendOrderConfirmationEmail(order);

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if ([400, 404, 409].includes(err.code)) {
      return NextResponse.json({ error: err.message }, { status: err.code });
    }
    console.error("[orders] create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
