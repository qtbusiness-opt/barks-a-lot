# Changelog

Notable changes to Barks-A-Lot Treats & More, by release. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`,
where MAJOR breaks how the site is used, MINOR adds a capability without
breaking anything, and PATCH fixes a bug with no new capability.

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
