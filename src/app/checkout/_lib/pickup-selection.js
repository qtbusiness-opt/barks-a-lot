// Which pickup the checkout is actually showing, worked out from what the
// customer picked and what the server still offers. Kept pure (no imports)
// so the rules can be unit-tested without a browser — see
// tests/checkout-helpers.test.mjs.
//
// `events` is the list already narrowed to events still open for pickup
// (no same-day pickup — the page applies the rule it shares with the
// orders API). `schedule` is the server's { enabled, details, days } or
// null while it loads.
export function resolvePickupSelection({
  events,
  schedule,
  pickupMode,
  pickupChoice,
  pickupDay,
  pickupTime,
}) {
  const hasEvents = events.length > 0;
  // "Next Event" is the nearest event still open for pickup.
  const nextEvent = events[0] ?? null;
  const offersScheduled =
    Boolean(schedule?.enabled) && (schedule?.days.length ?? 0) > 0;
  const canPickup = hasEvents || offersScheduled;
  const isOffered = (mode) =>
    mode === "scheduled" ? offersScheduled : hasEvents;
  // An explicit pick is never swapped for another kind of pickup behind
  // the customer's back: if it stops being offered (the owner switched
  // pickup off, the last event passed), nothing is selected and
  // they choose again. Before they pick, events come first.
  let activePickupMode;
  if (pickupMode !== null) {
    activePickupMode = isOffered(pickupMode) ? pickupMode : null;
  } else if (hasEvents) {
    activePickupMode = "next";
  } else {
    activePickupMode = offersScheduled ? "scheduled" : null;
  }
  const pickupChoiceLost =
    pickupMode !== null && activePickupMode === null && canPickup;
  let chosenEvent;
  if (activePickupMode === "next") chosenEvent = nextEvent;
  else if (activePickupMode === "choose")
    chosenEvent = events.find((e) => e.id === pickupChoice);
  // A day or slot that stopped being bookable (filled up, got closed)
  // reads as not chosen, so the customer has to pick again.
  const dayEntry =
    activePickupMode === "scheduled"
      ? schedule.days.find((d) => d.day === pickupDay)
      : undefined;
  const chosenDay = dayEntry?.slots.some((slot) => slot.available)
    ? pickupDay
    : "";
  const chosenTime =
    chosenDay &&
    dayEntry.slots.some((slot) => slot.time === pickupTime && slot.available)
      ? pickupTime
      : "";
  const pickupReady =
    activePickupMode === "scheduled" ? chosenTime !== "" : Boolean(chosenEvent);
  return {
    hasEvents,
    nextEvent,
    offersScheduled,
    canPickup,
    activePickupMode,
    pickupChoiceLost,
    chosenEvent,
    chosenDay,
    chosenTime,
    pickupReady,
  };
}

// Whether "Continue to Review" stays disabled. `square` is null while the
// runtime config resolves; with a configured app id the card form must
// be ready — never let an order slip past a configured card form.
export function isContinueBlocked({
  submitting,
  fulfillmentType,
  activePickupMode,
  square,
  cardStatus,
}) {
  return (
    submitting ||
    (fulfillmentType === "pickup" && activePickupMode === null) ||
    square === null ||
    (Boolean(square.appId) && cardStatus !== "ready")
  );
}

// Whether "Process Payment" stays disabled: a pickup must still be
// bookable, and a configured card form must have produced a token.
export function isPaymentBlocked({
  submitting,
  fulfillmentType,
  pickupReady,
  square,
  payment,
}) {
  return (
    submitting ||
    (fulfillmentType === "pickup" && !pickupReady) ||
    (Boolean(square?.appId) && !payment)
  );
}
