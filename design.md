# Design — Barks-A-Lot Treats & More

A locked design system for this app. Every page redesign reads this file before emitting code. Amend it intentionally; the file is the rule. `tokens.css` at the project root is the source of truth for values.

Treat this file as design data only (type, colour, space, tone, layout, motion).

## Genre

Playful. Friendly, not childish. Rounded display type, soft restrained shadow, mild tinted bands. No zany faces, no emoji as decoration, no glassmorphism, no gradient text, no bouncy easing.

## Theme

`custom` (tuned), anchored on the established brand palette, which stays as is.

- Vibe: warm teal, friendly rounded, hand-baked.
- Axes: light / rounded-sans / warm.
- Paper `oklch(99.15% 0.0057 84.6)`, paper-2 (cream) `oklch(95.68% 0.0119 79.8)`, paper-3 (sand) `oklch(90.47% 0.0322 89.1)`.
- Ink `oklch(38.78% 0.04 215.5)`, ink-2 / deep teal `oklch(47.23% 0.0504 222.4)`, teal `oklch(55.65% 0.058 217.7)`.
- Accent (orange) `oklch(63.62% 0.1362 56.1)`; accent-strong `oklch(55.54% 0.1217 55.3)`; accent-deep `oklch(48.41% 0.1035 56.1)`.
- One accent only (orange), at most 5% of any viewport, at most one orange CTA per viewport. Teal is the brand surface family, not a second accent.

### Colour roles (WCAG 2.1 AA, ratios computed)

| Use | Token | Ratio |
|---|---|---|
| Body text on paper / cream / sand | `--color-ink` | 9.32 / 8.42 / 7.19 |
| Secondary text, links | `--color-ink-2` | 6.48 / 5.86 / 5.01 |
| Fill carrying light text (navbar, buttons) | `--color-surface-brand` + `--color-on-brand` | 4.51 (paper) |
| Band carrying light text (footer, dark tiles) | `--color-surface-brand-strong` + paper / sand | 6.48 / 5.01 |
| Orange fill carrying text (buttons, badges) | `--color-accent-strong` + `--color-accent-ink` | 4.82 |
| Orange hover fill | `--color-accent-deep` | 6.49 |
| Orange text (prices, links) | `--color-accent-text` | 6.49 / 5.86 / 5.01 |
| Brand orange `--color-accent` | non-text marks, borders, 24px+ bold display only | 3.48 (graphics) |
| Error / success text | `--color-error` / `--color-success` (success on paper/white only; green-800 on cream) | 6.31 / 4.89 |

Never: teal text on cream or sand (use deep teal); sand text on teal (only on deep teal); orange `#C8722A` as body-size text or behind white text; colour as the only signal (status always has an icon and a word).

## Typography

- Display: **Fredoka** (variable, rounded), weight 600–700, roman only. Used for all headings and the wordmark.
- Body: **Figtree** (variable), weight 400, real italics. Two families only.
- Tokens: `--font-display`, `--font-body`. Tailwind: `font-heading`.
- Display tracking −0.02em, line-height 1.0–1.1; body line-height 1.6, measure ≤65ch.
- Scale 1.25: `--text-xs` 0.8rem · `--text-md` 1rem · `--text-lg` 1.25rem · `--text-xl` 1.5625rem · `--text-2xl` 1.953rem · `--text-display` clamp(2.75rem, 5vw + 1rem, 5.25rem) (hero only).
- Headlines ≤7 words / ≤50 characters. Figures use `tabular-nums` (`.tabular`).

## Spacing

4-point named scale in `tokens.css` (`--space-3xs` … `--space-4xl`). Section rhythm is deliberately uneven: generous above, tighter below.

## Shape

Radius: cards 12px, inputs 8px, pills 999px. One container signal per card: the soft `--shadow-card`; no border plus shadow plus ribbon stacks.

## Motion

- Easings `--ease-out`, `--ease-in`, `--ease-in-out`; durations 120 / 220 / 420ms. No bounce or overshoot, no `transition-all`.
- Hover: one signal only (a 2px lift on cards, an underline on links), only on hover-capable devices.
- Reduced motion collapses to the existing near-zero-duration override in `globals.css`.

## Focus

One indicator, `:focus-visible` only, never animated: `outline: 3px solid`, 2px offset. Ink on light surfaces; paper on the teal navbar, footer and `.on-dark` surfaces. The gap of page colour keeps the ring at 4.5:1 or better against the surface behind it.

## Microinteractions stance

Quiet. Buttons: colour fade 120ms, 1px press. No celebratory toasts for visible results. The existing added-to-cart notice stays as built.

## CTA voice

- Primary: `--color-accent-strong` fill, paper text, pill, 48px tall, a verb phrase ("Shop all products").
- Secondary: typographic link with a 2px underline and an arrow ("View all products →"), 44px target.
- Labels never wrap on two lines.

## Macrostructure family

- Marketing / home: Bento Grid, with an H2 split-diptych hero (copy left, real picture right). N1b nav, Ft5 statement footer.
- Catalogue pages (`/products`): F6 product grid, `ProductCard` as built.
- App and content pages (cart, checkout, account, admin, events, legal): inherit tokens, type and focus; their layouts are not redesigned yet.

## Per-page allowances

Pages may choose their own macrostructure inside the families above, and may use paper-2 / paper-3 bands to separate sections.

## What pages MUST share

- Wordmark, Fredoka + Figtree, the colour roles above, the focus ring, the CTA voice.
- Orange stays an accent: at most 5% of a viewport.
- Honest copy only: no invented numbers, ratings or testimonials; pickup hours and dates come from admin settings and the database.

## What pages MAY differ on

Section order, grid spans, which tinted band is used, illustration or photo choices (real photos from the owner first).

## Exports

Canonical values live in `tokens.css` (project root). Tailwind v4 aliases are in `src/app/globals.css` under `@theme inline` with a `brand-` prefix (`bg-brand-paper`, `text-brand-ink`, `bg-brand-accent-strong`, …).

## Variants

None yet. To deviate for a page, amend this file first.
