# Email branding: in-body logo & the inbox avatar (BIMI)

There are two separate "logo in email" things. One is fully handled in
code; the other is DNS/domain configuration only you can complete.

## 1. Logo inside the email body — DONE (in code)

Every branded customer email (order confirmation, status updates,
verification, password reset) embeds the logo as an **inline CID
attachment** (`src/lib/mailer.js`). The image travels inside the message,
so it renders even before the marketing site is publicly reachable and
regardless of `APP_URL`. Nothing to configure. The asset is
`public/images/email-logo.png` (regenerate from the master logo with
`sharp` if the brand art changes).

## 2. The sender avatar in the inbox list (BIMI)

The little round logo Gmail/Apple Mail show **next to the sender name**
in the inbox is **BIMI** (Brand Indicators for Message Identification).
It is **not** set from email code — it comes from DNS records plus your
mail authentication. This is the part to finish now that the Resend
domain is verified.

### Prerequisites

1. **SPF + DKIM aligned and passing.** Resend set these up when you
   verified `barks-a-lot.com` — good.
2. **DMARC at enforcement.** BIMI requires a DMARC policy of
   `p=quarantine` (with `pct=100`) or `p=reject`. `p=none` will **not**
   work. Check your current record:

   ```
   dig +short TXT _dmarc.barks-a-lot.com
   ```

   If it says `p=none`, tighten it (only after confirming your mail
   passes DMARC — Resend's dashboard shows this) to something like:

   ```
   _dmarc.barks-a-lot.com  TXT  "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@barks-a-lot.com"
   ```

### The BIMI record

1. Host the BIMI logo somewhere HTTPS. This repo ships one at
   `public/bimi-logo.svg`, so once the site is deployed it will be at:

   ```
   https://barks-a-lot.com/bimi-logo.svg
   ```

   It is authored in the required **SVG Tiny Portable/Secure (SVG P/S)**
   profile: `version="1.2"`, `baseProfile="tiny-ps"`, a `<title>`,
   square viewBox, no script/animation/raster. Validate it before going
   live at <https://bimigroup.org/bimi-generator/> (Inspector tab).

2. Add the BIMI DNS TXT record:

   ```
   default._bimi.barks-a-lot.com  TXT  "v=BIMI1; l=https://barks-a-lot.com/bimi-logo.svg; a="
   ```

   `l=` is the logo URL. `a=` is the (optional) VMC — see below.

### The catch: Gmail requires a VMC; Apple Mail does not

- **Apple Mail (iOS 16+/macOS Ventura+)** shows the BIMI logo with just
  the steps above — no certificate.
- **Gmail** only shows the avatar if `a=` points to a **Verified Mark
  Certificate (VMC)** — a paid certificate (~$1,000/yr, DigiCert or
  Entrust) that requires a **registered trademark** of the logo. Without
  a VMC, Gmail keeps showing the generic monogram; the record above is
  still valid and works in Apple Mail.

So: the DNS records get you the Apple Mail avatar immediately. The Gmail
avatar is a business decision (trademark + paid VMC) — everything in the
code and this repo is ready for it; add the `a=https://.../vmc.pem` value
to the BIMI record once you have the certificate.

### Note on the shipped SVG

`public/bimi-logo.svg` is a clean, valid starting mark (the two puppies
on the brand background). A VMC, if you pursue one, must certify a logo
that matches your **registered trademark** exactly — at that point your
certificate provider or a designer will supply the final SVG to host.
