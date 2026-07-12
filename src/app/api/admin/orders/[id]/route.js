import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendOrderStatusEmail } from "@/lib/order-emails";
import { restockOrderItems } from "@/lib/inventory";
import { SHIPPING_ENABLED } from "@/lib/features";
import {
  isPaymentConfigured,
  refundPayment,
  PaymentError,
} from "@/lib/payments";

const statusSchema = z.object({
  status: z.enum(["pending", "shipped", "delivered", "cancelled"]),
});

// While pickup-only, the "shipped"/"delivered" statuses keep their raw
// values but read as pickup milestones in customer notifications.
const STATUS_MESSAGES = {
  pending: "is being prepared",
  shipped: SHIPPING_ENABLED ? "has shipped" : "is ready for pickup",
  delivered: SHIPPING_ENABLED ? "has been delivered" : "has been picked up",
  cancelled: "has been cancelled",
};

export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { status } = parsed.data;

    const fail = (code, message) =>
      Object.assign(new Error(message), { code });

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw fail(404, "Order not found");

    // Cancelled is terminal: the items went back on the shelf and may
    // have sold since, so resurrecting the order could oversell.
    if (existing.status === "cancelled" && status !== "cancelled") {
      throw fail(409, "Cancelled orders can't be reactivated");
    }

    // Cancelling an active order refunds the charge and returns its items
    // to stock. A picked-up order's items are gone, so cancelling one is
    // a bookkeeping correction that touches neither money nor inventory.
    const cancelling =
      status === "cancelled" &&
      ["pending", "shipped"].includes(existing.status);

    // Refund outside the DB transaction (external call); the order-derived
    // idempotency key means a retry can never refund twice.
    let refunded = false;
    if (cancelling && existing.paymentId && isPaymentConfigured()) {
      await refundPayment({
        paymentId: existing.paymentId,
        amountCents: Math.round(existing.total * 100),
        orderId: existing.id,
        reason: `Cancelled ${existing.confirmationNumber}`,
      });
      refunded = true;
    }

    const { order, changed } = await prisma.$transaction(async (tx) => {
      if (cancelling) {
        // Atomic flip guards against a concurrent cancel (customer +
        // admin at once) restocking the same items twice.
        const { count } = await tx.order.updateMany({
          where: { id, status: { in: ["pending", "shipped"] } },
          data: { status },
        });
        if (count === 0) throw fail(409, "This order was already cancelled");
        await restockOrderItems(tx, existing.items);
      } else {
        await tx.order.update({ where: { id }, data: { status } });
      }

      const updated = await tx.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true, variant: true } },
          user: { select: { name: true, email: true } },
          pickupEvent: true,
        },
      });
      return { order: updated, changed: existing.status !== status };
    });

    // Record a customer notification tied to the order's email (account
    // email for customers, guest email for guest checkouts). Re-saving
    // the same status doesn't re-notify.
    const email = order.user?.email ?? order.guestEmail;
    if (email && changed) {
      const message =
        `Your order ${order.confirmationNumber} ${STATUS_MESSAGES[status]}.` +
        (refunded
          ? " Your payment has been refunded to your original payment method."
          : "");
      await prisma.notification.create({
        data: { email, orderId: order.id, message },
      });
      // The recorded notification is the source of truth; the email is
      // best-effort delivery of the same message.
      await sendOrderStatusEmail(order, message);
    }

    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        {
          error:
            "Square couldn't process the refund, so the order wasn't cancelled — please try again in a minute.",
        },
        { status: 502 }
      );
    }
    if ([404, 409].includes(err.code)) {
      return NextResponse.json({ error: err.message }, { status: err.code });
    }
    console.error("[admin] order status error:", err);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
