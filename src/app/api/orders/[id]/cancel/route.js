import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { restockOrderItems } from "@/lib/inventory";
import { sendOrderStatusEmail } from "@/lib/order-emails";
import {
  isPaymentConfigured,
  refundPayment,
  PaymentError,
} from "@/lib/payments";

// Customer self-service cancellation. Allowed until the order is picked
// up ("delivered"); refunds the Square charge, restores inventory, and
// notifies the customer, same as an admin-made cancellation.
export async function POST(req, { params }) {
  if (!rateLimit("cancel-order", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const fail = (code, message) =>
    Object.assign(new Error(message), { code });

  try {
    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    // Ownership check folded into the lookup: someone else's order id
    // is indistinguishable from a missing one.
    if (!existing || existing.userId !== auth.userId) {
      throw fail(404, "Order not found");
    }
    if (existing.status === "delivered") {
      throw fail(409, "This order has already been picked up");
    }
    if (existing.status === "cancelled") {
      throw fail(409, "This order is already cancelled");
    }

    // Refund before touching the order. The refund's idempotency key is
    // derived from the order id, so a retried cancellation can never
    // refund twice; if Square is unreachable the order stays active and
    // the customer can simply try again.
    let refunded = false;
    if (existing.paymentId && isPaymentConfigured()) {
      await refundPayment({
        paymentId: existing.paymentId,
        amountCents: Math.round(existing.total * 100),
        orderId: existing.id,
        reason: `Customer cancelled ${existing.confirmationNumber}`,
      });
      refunded = true;
    }

    const order = await prisma.$transaction(async (tx) => {
      // Atomic status flip guards against a concurrent double-cancel
      // restocking the same items twice.
      const { count } = await tx.order.updateMany({
        where: { id, status: { in: ["pending", "shipped"] } },
        data: { status: "cancelled" },
      });
      if (count === 0) throw fail(409, "This order is already cancelled");

      await restockOrderItems(tx, existing.items);

      return tx.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true, variant: true } },
          user: { select: { name: true, email: true } },
          pickupEvent: true,
        },
      });
    });

    console.info(`[orders] cancelled by customer order=${order.id}`);

    // Same notification + best-effort email pairing as admin status
    // changes — the recorded notification is the source of truth.
    const email = order.user?.email ?? order.guestEmail;
    if (email) {
      const message =
        `Your order ${order.confirmationNumber} has been cancelled.` +
        (refunded
          ? " Your payment has been refunded to your original payment method."
          : "");
      await prisma.notification.create({
        data: { email, orderId: order.id, message },
      });
      await sendOrderStatusEmail(order, message);
    }

    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        {
          error:
            "We couldn't process your refund just now, so the order wasn't cancelled — please try again in a minute.",
        },
        { status: 502 }
      );
    }
    if ([404, 409].includes(err.code)) {
      return NextResponse.json({ error: err.message }, { status: err.code });
    }
    console.error("[orders] cancel error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
