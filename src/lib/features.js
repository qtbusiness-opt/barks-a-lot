// Feature switches shared by server and client code (no secrets here).
//
// SHIPPING_ENABLED gates every shipping code path — the checkout delivery
// choice, order address capture, the profile address book, and the
// homepage free-shipping banner. Launch is pickup-only, so it's off;
// flip it to true to bring shipping back. Nothing was removed, only
// parked behind this flag.
export const SHIPPING_ENABLED = false;
