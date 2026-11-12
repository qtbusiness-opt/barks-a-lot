// Feature switches shared by server and client code (no secrets here).
//
// SHIPPING_ENABLED gates every shipping code path — the checkout delivery
// choice, order address capture, the profile address book, and the
// homepage free-shipping banner. Launch is pickup-only, so it's off;
// flip it to true to bring shipping back. Nothing was removed, only
// parked behind this flag.
export const SHIPPING_ENABLED = false;

// EVENT_PICKUP_ENABLED gates reserving an order for collection at a
// market or event — the "Next Event" / "Choose Event" options at checkout
// and pickupEventId on the orders API. Off: orders are collected by
// scheduled pickup only (a day and half-hour slot), and event days are
// blocked out of the pickup days instead. Parked, not removed, the same
// way shipping is.
export const EVENT_PICKUP_ENABLED = false;
