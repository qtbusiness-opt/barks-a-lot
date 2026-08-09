import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logEvent, clientIp } from "@/lib/log";

// Records a cart that was cleared at logout, so abandoned carts show up
// in the admin activity log alongside logins and errors. Analytics only:
// nothing here touches inventory, orders, or money, and the numbers are
// whatever the browser had — the trustworthy figures are on the orders.
const abandonedSchema = z.object({
  // Why the cart went away: the customer signed out, or their session
  // timed out and the app signed them out.
  reason: z.enum(["signed_out", "session_expired"]),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(1000),
        price: z.number().min(0).max(100000),
      })
    )
    .min(1)
    .max(50),
});

const REASON_LABEL = {
  signed_out: "signed out",
  session_expired: "session timed out",
};

export async function POST(req) {
  if (!rateLimit("cart-abandoned", req)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const parsed = abandonedSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    }
    const { reason, items } = parsed.data;

    // Identity comes from the session, never from the request body. A
    // timed-out session no longer resolves, so those entries record the
    // cart without an email rather than trusting a client-supplied one.
    const auth = await getAuthUser();

    const units = items.reduce((sum, i) => sum + i.quantity, 0);
    const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const lines = items.map((i) => `${i.name} x${i.quantity}`).join(", ");

    await logEvent({
      category: "cart",
      event: "cart_abandoned",
      message:
        `${units} item${units === 1 ? "" : "s"} · $${value.toFixed(2)} ` +
        `(${REASON_LABEL[reason]}) — ${lines}`.slice(0, 480),
      email: auth?.email ?? null,
      userId: auth?.userId ?? null,
      ip: clientIp(req),
    });

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (err) {
    console.error("[cart] abandoned-cart log error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
