import { test } from "node:test";
import assert from "node:assert/strict";

process.env.RATE_LIMIT_MAX = "5";
const { rateLimit } = await import("../src/lib/rate-limit.js");

function fakeReq(ip) {
  return { headers: { get: (name) => (name === "x-forwarded-for" ? ip : null) } };
}

test("allows up to the limit, then blocks", () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(rateLimit("unit-a", fakeReq("1.2.3.4")), true);
  }
  assert.equal(rateLimit("unit-a", fakeReq("1.2.3.4")), false);
});

test("limits are per IP", () => {
  for (let i = 0; i < 5; i++) rateLimit("unit-b", fakeReq("5.5.5.5"));
  assert.equal(rateLimit("unit-b", fakeReq("5.5.5.5")), false);
  assert.equal(rateLimit("unit-b", fakeReq("6.6.6.6")), true);
});

test("limits are per bucket", () => {
  for (let i = 0; i < 5; i++) rateLimit("unit-c", fakeReq("7.7.7.7"));
  assert.equal(rateLimit("unit-c", fakeReq("7.7.7.7")), false);
  assert.equal(rateLimit("unit-d", fakeReq("7.7.7.7")), true);
});
