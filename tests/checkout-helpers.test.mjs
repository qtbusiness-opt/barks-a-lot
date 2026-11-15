// Pure checkout helpers (src/app/checkout/_lib): which pickup the page is
// showing, when its two buttons are enabled, and the exact body sent to
// POST /orders. All sit on the money path, so these pin the behaviour the
// page had before they were pulled out of the component.
import { test } from "node:test";
import assert from "node:assert/strict";

const { resolvePickupSelection, isContinueBlocked, isPaymentBlocked } =
  await import("../src/app/checkout/_lib/pickup-selection.js");
const { buildOrderPayload, orderLinePayload } =
  await import("../src/app/checkout/_lib/order-payload.js");

const EVENT_A = { id: "e1", title: "Market", date: "2026-12-01" };
const EVENT_B = { id: "e2", title: "Expo", date: "2026-12-08" };
const SCHEDULE = {
  enabled: true,
  details: "Porch pickup",
  days: [
    {
      day: "2026-12-02",
      slots: [
        { time: "10:00", available: true },
        { time: "10:30", available: false },
      ],
    },
    { day: "2026-12-03", slots: [{ time: "10:00", available: false }] },
  ],
};

const select = (over) =>
  resolvePickupSelection({
    events: [],
    schedule: SCHEDULE,
    pickupMode: null,
    pickupChoice: "",
    pickupDay: "",
    pickupTime: "",
    ...over,
  });

test("before any pick, events come first, then scheduled pickup", () => {
  const withEvents = select({ events: [EVENT_A, EVENT_B] });
  assert.equal(withEvents.activePickupMode, "next");
  assert.equal(withEvents.chosenEvent, EVENT_A);
  assert.equal(withEvents.pickupReady, true);

  const scheduledOnly = select({});
  assert.equal(scheduledOnly.activePickupMode, "scheduled");
  assert.equal(scheduledOnly.pickupReady, false);
  assert.equal(scheduledOnly.pickupChoiceLost, false);

  const nothing = select({ schedule: null });
  assert.equal(nothing.activePickupMode, null);
  assert.equal(nothing.canPickup, false);
});

test("an explicit pick that stops being offered is dropped, not swapped", () => {
  const lost = select({ pickupMode: "next" });
  assert.equal(lost.activePickupMode, null);
  assert.equal(lost.pickupChoiceLost, true);
});

test("a full day or slot reads as not chosen", () => {
  const ok = select({ pickupDay: "2026-12-02", pickupTime: "10:00" });
  assert.equal(ok.chosenDay, "2026-12-02");
  assert.equal(ok.chosenTime, "10:00");
  assert.equal(ok.pickupReady, true);

  const fullSlot = select({ pickupDay: "2026-12-02", pickupTime: "10:30" });
  assert.equal(fullSlot.chosenTime, "");
  assert.equal(fullSlot.pickupReady, false);

  const fullDay = select({ pickupDay: "2026-12-03", pickupTime: "10:00" });
  assert.equal(fullDay.chosenDay, "");
  assert.equal(fullDay.chosenTime, "");
});

test("choose mode resolves the picked event id", () => {
  const picked = select({
    events: [EVENT_A, EVENT_B],
    pickupMode: "choose",
    pickupChoice: "e2",
  });
  assert.equal(picked.chosenEvent, EVENT_B);
  const none = select({ events: [EVENT_A], pickupMode: "choose" });
  assert.equal(none.chosenEvent, undefined);
  assert.equal(none.pickupReady, false);
});

test("order lines only carry variant and options when present", () => {
  assert.deepEqual(orderLinePayload({ productId: "p", quantity: 2 }), {
    productId: "p",
    quantity: 2,
  });
  assert.deepEqual(
    orderLinePayload({
      productId: "p",
      variantId: "v",
      quantity: 1,
      options: ["c1"],
      price: 999,
    }),
    { productId: "p", variantId: "v", quantity: 1, options: ["c1"] }
  );
});

const FORM = {
  guestName: "Ann",
  guestEmail: "ann@example.com",
  address: "1 Main",
  city: "Town",
  state: "OR",
  zip: "97000",
};
const ITEMS = [{ productId: "p", quantity: 1, price: 5 }];

test("order payload for a guest's scheduled pickup with a card and code", () => {
  assert.deepEqual(
    buildOrderPayload({
      items: ITEMS,
      fulfillmentType: "pickup",
      form: FORM,
      activePickupMode: "scheduled",
      chosenDay: "2026-12-02",
      chosenTime: "10:00",
      pickupChoice: "",
      isSignedIn: false,
      paymentToken: "tok",
      appliedCode: "SAVE",
    }),
    {
      items: [{ productId: "p", quantity: 1 }],
      fulfillmentType: "pickup",
      pickupDate: "2026-12-02",
      pickupTime: "10:00",
      guestEmail: "ann@example.com",
      guestName: "Ann",
      paymentToken: "tok",
      promoCode: "SAVE",
    }
  );
});

test("order payload for a signed-in event pickup and for shipping", () => {
  const base = {
    items: ITEMS,
    form: FORM,
    chosenDay: "",
    chosenTime: "",
    isSignedIn: true,
    paymentToken: undefined,
    appliedCode: "",
  };
  assert.deepEqual(
    buildOrderPayload({
      ...base,
      fulfillmentType: "pickup",
      activePickupMode: "next",
      pickupChoice: "e2",
    }),
    {
      items: [{ productId: "p", quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
    }
  );
  assert.deepEqual(
    buildOrderPayload({
      ...base,
      fulfillmentType: "pickup",
      activePickupMode: "choose",
      pickupChoice: "e2",
    }).pickupEventId,
    "e2"
  );
  assert.deepEqual(
    buildOrderPayload({
      ...base,
      fulfillmentType: "shipping",
      activePickupMode: null,
      pickupChoice: "",
    }),
    {
      items: [{ productId: "p", quantity: 1 }],
      fulfillmentType: "shipping",
      address: "1 Main",
      city: "Town",
      state: "OR",
      zip: "97000",
    }
  );
});

test("continue stays blocked until config and a configured card form are ready", () => {
  const base = {
    submitting: false,
    fulfillmentType: "pickup",
    activePickupMode: "scheduled",
    square: { appId: "sq", locationId: "" },
    cardStatus: "ready",
  };
  assert.equal(isContinueBlocked(base), false);
  assert.equal(isContinueBlocked({ ...base, square: null }), true);
  assert.equal(isContinueBlocked({ ...base, cardStatus: "loading" }), true);
  assert.equal(
    isContinueBlocked({ ...base, square: { appId: "" }, cardStatus: "off" }),
    false
  );
  assert.equal(isContinueBlocked({ ...base, activePickupMode: null }), true);
  assert.equal(
    isContinueBlocked({
      ...base,
      fulfillmentType: "shipping",
      activePickupMode: null,
    }),
    false
  );
  assert.equal(isContinueBlocked({ ...base, submitting: true }), true);
});

test("payment stays blocked without a bookable pickup or a card token", () => {
  const base = {
    submitting: false,
    fulfillmentType: "pickup",
    pickupReady: true,
    square: { appId: "sq" },
    payment: { token: "tok" },
  };
  assert.equal(isPaymentBlocked(base), false);
  assert.equal(isPaymentBlocked({ ...base, pickupReady: false }), true);
  assert.equal(isPaymentBlocked({ ...base, payment: null }), true);
  assert.equal(
    isPaymentBlocked({ ...base, square: { appId: "" }, payment: null }),
    false
  );
  assert.equal(isPaymentBlocked({ ...base, submitting: true }), true);
});
