// Which paths the optional staging Basic Auth gate must never challenge.
//
// Kept out of src/proxy.js (which imports next/server, and so can only be
// loaded by Next's bundler) so this rule is plain logic that can be
// tested directly — see tests/proxy-gate.test.mjs.

// Image bytes: files under public/ and admin uploads served out of the
// database. next/image doesn't hand the browser the original file — it
// re-fetches the source server-side and re-encodes it, and that internal
// request carries none of the browser's credentials. Challenge these and
// the optimizer receives the 401 body instead of an image and reports
// "The requested resource isn't a valid image", so every photo breaks
// while SVGs (served unoptimized, and therefore fetched by the browser
// itself) keep working. Product photos are public content on a public
// storefront and an upload's name is 16 hex characters, so serving them
// past the gate gives away nothing the gate exists to protect.
const IMAGE_PREFIXES = ["/images/", "/api/uploads/"];

// Docker healthchecks and platform probes don't send credentials.
const OPEN_PATHS = ["/api/health"];

export function bypassesStagingGate(pathname) {
  if (OPEN_PATHS.includes(pathname)) return true;
  return IMAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
