import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { restockOrderItems } from "@/lib/inventory";
import { sendOrderStatusEmail } from "@/lib/order-emails";

// Customer self-service cancellation. Allowed until the order is picked
// up ("delivered"); restores inventory and notifies the customer, same
// as an admin-made cancellation.
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
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
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

      await restockOrderItems(tx, existing.items);

      return tx.order.update({
        where: { id },
        data: { status: "cancelled" },
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
      const message = `Your order ${order.confirmationNumber} has been cancelled.`;
      await prisma.notification.create({
        data: { email, orderId: order.id, message },
      });
      await sendOrderStatusEmail(order, message);
    }

    return NextResponse.json({ order });
  } catch (err) {
    if ([404, 409].includes(err.code)) {
      return NextResponse.json({ error: err.message }, { status: err.code });
    }
    console.error("[orders] cancel error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
