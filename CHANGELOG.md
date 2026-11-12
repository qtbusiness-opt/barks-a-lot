# Changelog

Notable changes to Barks-A-Lot Treats & More, by release. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`,
where MAJOR breaks how the site is used, MINOR adds a capability without
breaking anything, and PATCH fixes a bug with no new capability.

## [Unreleased]

### Added

- Order lines remember the photo they were bought as. The picture the
  customer picked — the bandana pattern, not just the product's cover —
  is frozen onto the order at checkout and shown in order history, in
  the admin Orders page, and in both order emails. Replacing a product
  photo or retiring an option no longer changes what a past order looks
  like, the same guarantee the option labels already had.
- Item photos in the order emails, for the customer's confirmation as
  well as the admin's heads-up. They appear only when `APP_URL` is set
  and the photo is a raster: a message that has left the site can't load
  a relative path, and mail clients won't draw SVG. Otherwise the emails
  stay exactly as they were.
- Scheduled pickup: customers collect an online order on a day and
  30-minute time slot they book at checkout — Monday through Saturday,
  never the same day (store time), from the next 10 open days. Each slot
  takes up to 5 orders; a full slot shows as full and can't be booked.
  Managed in Admin → Pickup: an on/off switch (off by default), pickup
  hours (3:00–6:00 PM until changed), the where-to-collect details shown
  to customers, and closed days for holidays or days off.
- Events take priority over pickup: a day with an event on the calendar is
  blocked out of the pickup days automatically.
- Events list by month: `/events` lists upcoming events grouped by month,
  this month open (or the nearest month with events), others one click
  away. Each event links to its day page.

### Changed

- `/events` opens on the list; the calendar is one click away
  ("Calendar view", top right). The day page links "Back to Events".
- Orders can no longer be reserved for collection at a market or event.
  The "Next Event" and "Choose Event" options are gone from checkout and
  the orders API refuses them; the code is parked behind
  `EVENT_PICKUP_ENABLED`, the same way shipping is. Existing event-pickup
  orders are unchanged.
- Terms of Service §4, the Privacy Policy and the homepage describe
  scheduled pickup.

### Fixed

- Today's events count as upcoming all day in store time. The cutoff used
  the UTC date, so the events list, checkout and the dashboard dropped
  them after about 5 PM in Boise.
- The admin event forms no longer claim online pickup closes 2 hours
  before the event ends; they say event days can't be booked for pickup.

## [1.1.0] — 2026-08-20

### Added

- Picking a product option that has a photo of its own — a carousel
  thumbnail, typically — brings that photo up as the main product image,
  and carries it through to the cart line and the added-to-cart notice.
  The product's own photos stay one click away in the strip beneath it.
- Quantity stepper on product cards, so a product with nothing to choose
  can be added from the listing page several at a time instead of one
  click per unit.

## [1.0.0] — 2026-08-19

Initial release.

### Added

- Storefront: catalog browsing, cart, checkout, order history, account
  management, event calendar for market/expo pickup.
- Product options that carry their own price and stock: an admin can
  flag one option group (e.g. Size) to set the price per choice, while
  every combination across the required groups (e.g. Size × Style) gets
  its own tracked quantity — toggleable per product, not specific to any
  one product type.
- Session-timeout handling: idle customers and admins are signed out
  automatically, with a countdown warning before it happens; abandoned
  carts are logged for analytics.
- Nutrition facts table on treat product pages.
- Same-day pickup cutoff: an event can no longer be reserved for pickup
  on the day it happens — reservations close the day before.
- App version surfaced in the admin footer and at `/api/health`.

### Changed

- Product detail pages are addressed by name (`/products/{slug}`)
  instead of a raw id; old id links still resolve.
- The image optimizer is back on for uploaded photos (was disabled to
  remove its dependency's attack surface — re-enabled as a deliberate,
  audited tradeoff for real bandwidth savings).

### Fixed

- The product option carousel's ‹ › buttons updated their selection but
  never actually scrolled the row.
- A product with required options could be added to the cart straight
  from the listing page with no options chosen, then fail at checkout
  with no way to fix it from the cart.
- The cart could be emptied by two order lines for the identical
  product/option combination racing against the same stock count instead
  of being checked against each other.
- Local development cart could be wiped on page reload.
