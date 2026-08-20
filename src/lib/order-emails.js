import { sendEmail, adminEmails } from "@/lib/mailer";
import { formatTimeRange } from "@/lib/pickup-window";
import { logEvent } from "@/lib/log";

// Order mail used to fail only into the server console, which on a hosted
// deployment means nobody sees it. These land in the admin Logs page
// (Errors tab) instead, so "no email arrived" is answerable from the
// dashboard rather than by reading container logs.
// The recipient goes in the dedicated `email` column rather than being
// baked into the message, matching how auth events already record one.
const mailProblem = (event, message, email = null) =>
  logEvent({
    level: "error",
    category: "error",
    event,
    message,
    email,
    path: "/api/orders",
  });

// sendEmail resolves with delivered:false when RESEND_API_KEY is unset —
// the local-dev path, where mail is logged rather than sent. On a real
// deployment that means the key is missing and nothing went out at all.
const noteIfUndelivered = (result, event, message, email = null) =>
  result?.delivered === false ? mailProblem(event, message, email) : undefined;

// event.date is a Date object when the order comes straight from Prisma
// and an ISO string when it has been through JSON — handle both.
const fmtEventDate = (event) => {
  const day =
    event.date instanceof Date
      ? event.date.toISOString().slice(0, 10)
      : String(event.date).slice(0, 10);
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function deliveryLine(order) {
  if (order.fulfillmentType === "pickup") {
    if (!order.pickupEvent) return "Pickup at our next market/event";
    const times = formatTimeRange(order.pickupEvent);
    return `Pickup at ${order.pickupEvent.title} on ${fmtEventDate(order.pickupEvent)}${times ? `, ${times}` : ""}${order.pickupEvent.location ? ` (${order.pickupEvent.location})` : ""}`;
  }
  return `Shipping to ${order.address}, ${order.city}, ${order.state} ${order.zip}`;
}

function itemLines(order) {
  return order.items
    .map(
      (i) =>
        `  - ${i.product.name}${i.variant ? ` (${i.variant.name})` : ""} x ${i.quantity} — $${(i.price * i.quantity).toFixed(2)}`
    )
    .join("\n");
}

// Subtotal + discount lines, shown only when a promotion applied.
function totalsBlock(order) {
  if (order.discountTotal && order.discountTotal > 0) {
    const subtotal = order.total + order.discountTotal;
    return `Subtotal: $${subtotal.toFixed(2)}\nDiscount: -$${order.discountTotal.toFixed(2)}\nTotal: $${order.total.toFixed(2)}`;
  }
  return `Total: $${order.total.toFixed(2)}`;
}

// Confirmation sent when checkout completes. Email failures are logged,
// never surfaced — the order is already placed and paid.
export async function sendOrderConfirmationEmail(order) {
  const to = order.user?.email ?? order.guestEmail;
  if (!to) return;

  try {
    const result = await sendEmail({
      to,
      subject: `Order confirmed — ${order.confirmationNumber}`,
      text: `Thanks for your order from Barks-A-Lot Treats & More!\n\nConfirmation number: ${order.confirmationNumber}\n\nItems:\n${itemLines(order)}\n\n${totalsBlock(order)}\n${deliveryLine(order)}\n\nWe'll email you when your order's status changes. If you have any questions, you can reach us at info@barks-a-lot.com.`,
      branded: true,
    });
    await noteIfUndelivered(
      result,
      "order_confirmation_not_sent",
      `No confirmation sent for order ${order.confirmationNumber}: email is not configured (RESEND_API_KEY is unset).`,
      to
    );
  } catch (err) {
    await mailProblem(
      "order_confirmation_failed",
      `Confirmation for order ${order.confirmationNumber} failed: ${err?.message ?? "unknown error"}`,
      to
    );
  }
}

// Internal heads-up to every admin whenever an order is placed. Failures
// are logged only — a mail hiccup must never fail a completed order.
export async function sendAdminOrderAlert(order) {
  // Declared outside the try so the catch below can still name the
  // recipients when the failure happens partway through the send.
  let to = [];
  try {
    to = await adminEmails();
    if (to.length === 0) {
      // Recipients are the login addresses of every admin-role account,
      // so an empty list means there is no admin user to notify.
      await mailProblem(
        "admin_alert_no_recipients",
        `Order ${order.confirmationNumber} placed, but no admin account exists to notify.`
      );
      return;
    }

    const customer = order.user
      ? `${order.user.name} (${order.user.email})`
      : `${order.guestName ? `${order.guestName} — ` : ""}${order.guestEmail} (guest)`;

    const result = await sendEmail({
      to,
      subject: `New order ${order.confirmationNumber} — $${order.total.toFixed(2)}`,
      text: `A new order just came in.\n\nConfirmation number: ${order.confirmationNumber}\nCustomer: ${customer}\n\nItems:\n${itemLines(order)}\n\n${totalsBlock(order)}${order.promoCode ? `\nPromo code: ${order.promoCode}` : ""}\n${deliveryLine(order)}\n\nManage it in the admin dashboard under Orders.`,
    });
    await noteIfUndelivered(
      result,
      "admin_alert_not_sent",
      `No admin alert sent for order ${order.confirmationNumber}: email is not configured (RESEND_API_KEY is unset).`
    );
  } catch (err) {
    await mailProblem(
      "admin_alert_failed",
      `Admin alert to ${to.join(", ")} for order ${order.confirmationNumber} failed: ${err?.message ?? "unknown error"}`
    );
  }
}

// Status-change email that accompanies the recorded customer notification.
export async function sendOrderStatusEmail(order, message) {
  const to = order.user?.email ?? order.guestEmail;
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject: `Order update — ${order.confirmationNumber}`,
      text: `${message}\n\n${deliveryLine(order)}\n\nQuestions? You can reach us at info@barks-a-lot.com.`,
      branded: true,
    });
  } catch (err) {
    await mailProblem(
      "order_status_email_failed",
      `Status email for order ${order.confirmationNumber} failed: ${err?.message ?? "unknown error"}`,
      to
    );
  }
}
