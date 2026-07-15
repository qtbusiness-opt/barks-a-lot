// Square Payments API over plain HTTPS (no SDK dependency). Sandbox vs
// production is chosen by SQUARE_ENV; the access token stays server-side
// only. When no token is configured (local dev, tests) charging is
// skipped entirely and orders proceed unpaid — mirrors the mailer's
// console fallback.

const API_BASE =
  process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

export function isPaymentConfigured() {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN);
}

// One location id serves both halves: the browser passes it to the Web
// Payments SDK (NEXT_PUBLIC_), and the server reuses it for CreatePayment.
const locationId = () =>
  process.env.SQUARE_LOCATION_ID || process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

// Thrown with a customer-safe message; details go to server logs only.
export class PaymentError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "PaymentError";
    this.details = details;
  }
}

async function squareRequest(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = data.errors ?? [];
    console.error(`[payments] Square ${path} failed:`, JSON.stringify(errors));
    // Card declines come back as specific error codes; everything else is
    // an integration/availability problem the customer can't fix.
    const declined = errors.some((e) =>
      ["GENERIC_DECLINE", "CVV_FAILURE", "ADDRESS_VERIFICATION_FAILURE",
        "INVALID_EXPIRATION", "CARD_EXPIRED", "INSUFFICIENT_FUNDS",
        "CARD_DECLINED_VERIFICATION_REQUIRED", "PAN_FAILURE"].includes(e.code)
    );
    throw new PaymentError(
      declined
        ? "Your card was declined — please check the details or try another card."
        : "We couldn't process your payment. Please try again in a moment.",
      errors
    );
  }
  return data;
}

// Charges the tokenized card for the server-computed total. amountCents
// must come from the order transaction, never the client.
export async function chargePayment({ sourceId, amountCents, note }) {
  const body = {
    source_id: sourceId,
    idempotency_key: crypto.randomUUID(),
    amount_money: { amount: amountCents, currency: "USD" },
    note,
  };
  if (locationId()) {
    body.location_id = locationId();
  }
  const data = await squareRequest("/v2/payments", body);
  console.info(
    `[payments] charged ${amountCents}¢ payment=${data.payment.id} (${note})`
  );
  return data.payment;
}

// Refunds the full charge for a cancelled order. The idempotency key is
// derived from the order, so retrying a failed cancellation can never
// refund twice.
export async function refundPayment({ paymentId, amountCents, orderId, reason }) {
  const data = await squareRequest("/v2/refunds", {
    payment_id: paymentId,
    idempotency_key: `refund-${orderId}`,
    amount_money: { amount: amountCents, currency: "USD" },
    reason,
  });
  console.info(
    `[payments] refunded ${amountCents}¢ payment=${paymentId} refund=${data.refund.id}`
  );
  return data.refund;
}
