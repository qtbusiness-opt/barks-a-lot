// Which paths the staging Basic Auth gate is allowed to challenge
// (src/lib/staging-gate.js, used by src/proxy.js).
//
// These exist because of a bug that was genuinely hard to see from the
// outside: next/image doesn't hand the browser the original file, it
// re-fetches the source server-side and re-encodes it, and that internal
// request carries none of the browser's credentials. With image bytes
// behind the gate the optimizer received the 401 body instead of an
// image and reported "The requested resource isn't a valid image", so
// every photo on the staging site broke while SVGs — served unoptimized,
// and therefore fetched by the browser itself, which does have the
// credentials — kept working. Opening the raw URL by hand also worked,
// which made it look like the files were fine.
import { test } from "node:test";
import assert from "node:assert/strict";

const { bypassesStagingGate } = await import("../src/lib/staging-gate.js");

const isChallenged = (pathname) => !bypassesStagingGate(pathname);

test("image bytes are never challenged, so the optimizer can fetch them", () => {
  // The two shapes next/image re-fetches: files under public/, and admin
  // uploads served out of the database.
  for (const path of [
    "/images/barks-a-lot-logo.png",
    "/images/products/bandana-set.svg",
    "/api/uploads/a1b2c3d4e5f60789.png",
  ]) {
    assert.equal(
      isChallenged(path),
      false,
      `${path} must not be challenged — the optimizer would get the 401 body instead of an image`
    );
  }
});

test("health stays open for platform probes", () => {
  assert.equal(isChallenged("/api/health"), false);
});

test("everything else stays behind the gate", () => {
  for (const path of [
    "/",
    "/products",
    "/products/bandana-set-3-pack",
    "/checkout",
    "/admin",
    "/api/products",
    "/api/config",
    "/api/orders",
  ]) {
    assert.equal(isChallenged(path), true, `${path} must stay gated`);
  }
});

test("the exemption is image bytes only, not a hole in /api", () => {
  // Prefix-adjacent paths that must not inherit the exemption — note
  // /api/admin/uploads is the authenticated *write* route.
  for (const path of [
    "/api/uploadsfoo",
    "/api/admin/uploads",
    "/api/upload",
    "/imagesfoo",
    "/api/healthz",
  ]) {
    assert.equal(isChallenged(path), true, `${path} must stay gated`);
  }
});
