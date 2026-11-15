// Request bodies checkout sends to the server. Kept pure (no imports) so
// they can be unit-tested — see tests/checkout-helpers.test.mjs. The
// server re-verifies every price, option and pickup in them; nothing here
// is trusted.

// One shared line shape for every call that sends the cart to the
// server — the two promo-preview calls and the real order submit. Built
// once so options can't quietly drop from one of the three and make a
// preview disagree with the price checkout actually charges.
export const orderLinePayload = (i) => ({
  productId: i.productId,
  ...(i.variantId ? { variantId: i.variantId } : {}),
  quantity: i.quantity,
  // The server re-resolves these ids to labels and prices, and re-checks
  // required groups, before the order is written.
  ...(i.options?.length ? { options: i.options } : {}),
});

// Where the order goes: a shipping address, a booked pickup day and slot,
// or an event ("next" lets the server pick the nearest open one).
function fulfillmentPayload({
  fulfillmentType,
  form,
  activePickupMode,
  chosenDay,
  chosenTime,
  pickupChoice,
}) {
  if (fulfillmentType === "shipping") {
    return {
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
    };
  }
  if (activePickupMode === "scheduled") {
    return { pickupDate: chosenDay, pickupTime: chosenTime };
  }
  return {
    pickupEventId: activePickupMode === "next" ? "next" : pickupChoice,
  };
}

// The body of POST /orders. Signed-in customers are identified by their
// session, so only guests send a name and email.
export function buildOrderPayload({
  items,
  fulfillmentType,
  form,
  activePickupMode,
  chosenDay,
  chosenTime,
  pickupChoice,
  isSignedIn,
  paymentToken,
  appliedCode,
}) {
  return {
    items: items.map(orderLinePayload),
    fulfillmentType,
    ...fulfillmentPayload({
      fulfillmentType,
      form,
      activePickupMode,
      chosenDay,
      chosenTime,
      pickupChoice,
    }),
    ...(isSignedIn
      ? {}
      : { guestEmail: form.guestEmail, guestName: form.guestName }),
    ...(paymentToken ? { paymentToken } : {}),
    ...(appliedCode ? { promoCode: appliedCode } : {}),
  };
}
