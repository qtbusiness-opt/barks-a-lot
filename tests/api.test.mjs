// Integration tests for the two money-critical areas (CLAUDE.md §6):
// checkout (order creation, inventory decrement) and auth (login,
// protected route access). Boots the real Next.js app against a
// throwaway SQLite database.
//
// Run with: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const PORT = 4123;
const BASE = `http://localhost:${PORT}`;
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-admin-pw8";

let server;
let dbDir;
let dbUrl;

function cookieFrom(res) {
  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function api(method, route, { body, cookie } = {}) {
  const res = await fetch(`${BASE}/api${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  return { status: res.status, data, cookie: cookieFrom(res) };
}

before(async () => {
  dbDir = mkdtempSync(path.join(tmpdir(), "barks-test-"));
  dbUrl = `file:${path.join(dbDir, "test.db")}`;
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    JWT_SECRET: "test-secret",
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    RATE_LIMIT_MAX: "1000",
    UPLOADS_DIR: path.join(dbDir, "uploads"),
    NODE_ENV: "development",
  };

  execSync("node node_modules/prisma/build/index.js migrate deploy", {
    env,
    stdio: "pipe",
  });
  execSync("node prisma/seed.js", { env, stdio: "pipe" });

  // stdio must be drained or ignored — an unread pipe fills up and blocks
  // the dev server mid-boot.
  server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    env,
    stdio: "ignore",
  });

  // Wait for the health endpoint to confirm app + DB are up.
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.status === 200) break;
    } catch {
      // server not up yet
    }
    if (Date.now() > deadline) throw new Error("Server failed to start");
    await new Promise((r) => setTimeout(r, 1000));
  }
});

after(() => {
  if (server) server.kill("SIGTERM");
  if (dbDir) rmSync(dbDir, { recursive: true, force: true });
});

// Sign in through the Auth.js credentials flow: fetch a CSRF token, then
// post the form to the credentials callback. Returns the session cookie,
// or "" when the credentials were rejected.
async function loginAs(email, password) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = csrfRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies,
    },
    body: new URLSearchParams({ csrfToken, email, password }),
    redirect: "manual",
  });

  const sessionCookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("authjs.session-token="));
  return sessionCookie ? `${csrfCookies}; ${sessionCookie}` : "";
}

test("register creates an unverified account; login is blocked until verified", async () => {
  const res = await api("POST", "/auth/register", {
    body: { name: "Test User", email: "user@test.local", password: "secret123" },
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, "customer");
  // Test server runs in development with no mail provider, so the
  // verification link comes back for local testing.
  assert.ok(res.data.devVerificationUrl, "dev verification link returned");

  // Correct credentials are rejected until the email is verified.
  const blocked = await loginAs("user@test.local", "secret123");
  assert.equal(blocked, "");

  // Consuming the emailed token verifies the account...
  const token = new URL(res.data.devVerificationUrl).searchParams.get("token");
  const verified = await api("POST", "/auth/verify", { body: { token } });
  assert.equal(verified.status, 200);

  // ...and the token is single-use.
  const reused = await api("POST", "/auth/verify", { body: { token } });
  assert.equal(reused.status, 400);

  const cookie = await loginAs("user@test.local", "secret123");
  assert.match(cookie, /authjs\.session-token=/);
});

test("resend verification always answers 200 and reissues for unverified accounts", async () => {
  const reg = await api("POST", "/auth/register", {
    body: { name: "Resend Tester", email: "resend@test.local", password: "secret123" },
  });
  assert.equal(reg.status, 201);

  // Unknown emails get the same response — no account probing.
  const unknown = await api("POST", "/auth/resend-verification", {
    body: { email: "who@test.local" },
  });
  assert.equal(unknown.status, 200);

  const resent = await api("POST", "/auth/resend-verification", {
    body: { email: "resend@test.local" },
  });
  assert.equal(resent.status, 200);

  // The original link was invalidated by the resend; garbage tokens fail.
  const oldToken = new URL(reg.data.devVerificationUrl).searchParams.get("token");
  const stale = await api("POST", "/auth/verify", { body: { token: oldToken } });
  assert.equal(stale.status, 400);
});

test("register rejects invalid input", async () => {
  const res = await api("POST", "/auth/register", {
    body: { name: "", email: "not-an-email", password: "1" },
  });
  assert.equal(res.status, 400);
});

test("login rejects a wrong password", async () => {
  const cookie = await loginAs("user@test.local", "wrong-password");
  assert.equal(cookie, "");
});

test("login succeeds with correct credentials", async () => {
  const cookie = await loginAs("user@test.local", "secret123");
  assert.match(cookie, /authjs\.session-token=/);
});

test("orders API requires auth for order history", async () => {
  const res = await api("GET", "/orders");
  assert.equal(res.status, 401);
});

test("guest checkout requires an email", async () => {
  const { data: products } = await api("GET", "/products");
  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: products.products[0].id, quantity: 1 }],
      fulfillmentType: "pickup",
    },
  });
  assert.equal(res.status, 400);
});

test("guest pickup order succeeds without address and decrements stock", async () => {
  const { data: before } = await api("GET", "/products");
  const product = before.products.find((p) => p.quantity >= 2);

  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 2 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(res.status, 201);
  assert.match(res.data.order.confirmationNumber, /^BAL-/);
  assert.equal(res.data.order.userId, null);

  const { data: after } = await api("GET", `/products/${product.id}`);
  assert.equal(after.product.quantity, product.quantity - 2);
});

test("shipping order without an address is rejected", async () => {
  const { data: products } = await api("GET", "/products");
  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: products.products[0].id, quantity: 1 }],
      fulfillmentType: "shipping",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(res.status, 400);
});

test("ordering more than available stock is rejected and nothing is written", async () => {
  const { data: products } = await api("GET", "/products");
  const product = products.products[0];

  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: product.quantity + 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(res.status, 409);

  const { data: after } = await api("GET", `/products/${product.id}`);
  assert.equal(after.product.quantity, product.quantity);
});

test("logged-in customer order is linked to the account", async () => {
  const cookie = await loginAs("user@test.local", "secret123");
  assert.notEqual(cookie, "");

  const { data: products } = await api("GET", "/products");
  const product = products.products.find((p) => p.quantity >= 1);

  const created = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "shipping",
      address: "1 Test St",
      city: "Boise",
      state: "ID",
      zip: "83701",
    },
    cookie,
  });
  assert.equal(created.status, 201);

  const history = await api("GET", "/orders", { cookie });
  assert.equal(history.status, 200);
  assert.ok(
    history.data.orders.some((o) => o.id === created.data.order.id),
    "order appears in the customer's history"
  );
});

test("admin API is forbidden for anonymous and customer sessions", async () => {
  const anon = await api("GET", "/admin/orders");
  assert.equal(anon.status, 403);

  const cookie = await loginAs("user@test.local", "secret123");
  const asCustomer = await api("GET", "/admin/orders", { cookie });
  assert.equal(asCustomer.status, 403);
});

test("admin can list orders and update status", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.notEqual(cookie, "");

  const list = await api("GET", "/admin/orders", { cookie });
  assert.equal(list.status, 200);
  assert.ok(list.data.orders.length >= 1);

  const orderId = list.data.orders[0].id;
  const patched = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "shipped" },
    cookie,
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.order.status, "shipped");

  const invalid = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "not-a-status" },
    cookie,
  });
  assert.equal(invalid.status, 400);
});

test("variant products require an option and track per-variant stock", async () => {
  const { data } = await api("GET", "/products");
  const product = data.products.find((p) => p.variants.length > 0);
  assert.ok(product, "seeded variant product exists");

  // Ordering a variant product without choosing an option is rejected.
  const noVariant = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(noVariant.status, 400);

  const variant = product.variants.find((v) => v.quantity >= 2);
  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(res.status, 201);
  const line = res.data.order.items[0];
  assert.equal(line.variantId, variant.id);
  assert.equal(line.price, variant.price ?? product.price);

  // Only the chosen variant's stock is decremented.
  const detail = await api("GET", `/products/${product.id}`);
  const afterVariant = detail.data.product.variants.find((v) => v.id === variant.id);
  assert.equal(afterVariant.quantity, variant.quantity - 2);

  // Overselling a single variant is rejected.
  const oversell = await api("POST", "/orders", {
    body: {
      items: [
        { productId: product.id, variantId: variant.id, quantity: afterVariant.quantity + 1 },
      ],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(oversell.status, 409);
});

test("limited drops report remaining stock in listings", async () => {
  const { data } = await api("GET", "/products");
  const drop = data.products.find((p) => p.limitedQuantity != null);
  assert.ok(drop, "seeded limited drop is visible while in its window");
  assert.ok(drop.quantity <= drop.limitedQuantity);
});

test("expired limited drops are hidden and cannot be purchased", async () => {
  // Insert an already-expired drop directly — there is deliberately no
  // public API for creating products.
  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  const expired = await prisma.product.create({
    data: {
      name: "Expired Test Drop",
      description: "A drop whose window has closed",
      quantity: 5,
      limitedQuantity: 5,
      price: 9.99,
      image: "/images/products/plush-duck.svg",
      category: "toys",
      availableFrom: new Date(Date.now() - 60 * 86400_000),
      availableUntil: new Date(Date.now() - 30 * 86400_000),
    },
  });
  await prisma.$disconnect();

  const { data } = await api("GET", "/products");
  assert.ok(
    !data.products.some((p) => p.id === expired.id),
    "expired drop is hidden from listings"
  );

  const detail = await api("GET", `/products/${expired.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.product.available, false);

  const purchase = await api("POST", "/orders", {
    body: {
      items: [{ productId: expired.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(purchase.status, 409);
});

test("admin stats are admin-only and back the four dashboard panels", async () => {
  const anon = await api("GET", "/admin/stats");
  assert.equal(anon.status, 403);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const res = await api("GET", "/admin/stats", { cookie });
  assert.equal(res.status, 200);
  const { stats } = res.data;
  assert.ok(stats.orders.total >= 1);
  assert.ok(stats.products.inStock >= 1);
  assert.ok(typeof stats.announcements === "number");
  assert.ok(typeof stats.notifications === "number");
});

test("admins can create products that appear on the storefront", async () => {
  const payload = {
    name: "Test Admin Biscuit",
    description: "Created through the admin dashboard",
    price: 7.5,
    image: "/images/products/squeaky-bone.svg",
    category: "treats",
    quantity: 5,
    featured: false,
  };

  const anon = await api("POST", "/admin/products", { body: payload });
  assert.equal(anon.status, 403);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const invalid = await api("POST", "/admin/products", {
    body: { ...payload, price: -2, category: "nonsense" },
    cookie,
  });
  assert.equal(invalid.status, 400);

  const created = await api("POST", "/admin/products", { body: payload, cookie });
  assert.equal(created.status, 201);
  assert.equal(created.data.product.inStock, true);

  const zeroStock = await api("POST", "/admin/products", {
    body: { ...payload, name: "Test Sold Out Biscuit", quantity: 0 },
    cookie,
  });
  assert.equal(zeroStock.status, 201);
  assert.equal(zeroStock.data.product.inStock, false);

  const { data } = await api("GET", "/products");
  assert.ok(
    data.products.some((p) => p.id === created.data.product.id),
    "new product is visible on the public storefront"
  );
});

test("status changes record a notification tied to the order email", async () => {
  const email = "notify-me@test.local";
  const { data: products } = await api("GET", "/products");
  const product = products.products.find((p) => p.variants.length === 0 && p.quantity >= 1);

  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: email,
    },
  });
  assert.equal(order.status, 201);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const list = await api("GET", "/admin/orders", { cookie });
  const target = list.data.orders.find(
    (o) => o.confirmationNumber === order.data.order.confirmationNumber
  );
  const patched = await api("PATCH", `/admin/orders/${target.id}`, {
    body: { status: "delivered" },
    cookie,
  });
  assert.equal(patched.status, 200);

  const notifications = await api("GET", "/admin/notifications", { cookie });
  assert.equal(notifications.status, 200);
  assert.ok(
    notifications.data.notifications.some(
      (n) => n.email === email && n.message.includes("delivered")
    ),
    "notification recorded against the guest email"
  );
});

test("announcements: admin creates, storefront shows the latest", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const anon = await api("POST", "/admin/announcements", {
    body: { title: "x", body: "y" },
  });
  assert.equal(anon.status, 403);

  const created = await api("POST", "/admin/announcements", {
    body: { title: "Market This Weekend", body: "Find us at the farmers market Saturday 9-2!" },
    cookie,
  });
  assert.equal(created.status, 201);

  const latest = await api("GET", "/announcements");
  assert.equal(latest.status, 200);
  assert.equal(latest.data.announcement.title, "Market This Weekend");
});

test("admins can edit products; unchecking In Stock wipes quantity", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const created = await api("POST", "/admin/products", {
    body: {
      name: "Test Editable Chew",
      description: "About to be edited",
      price: 5,
      image: "/images/products/rope-toy.svg",
      category: "toys",
      quantity: 9,
      featured: false,
    },
    cookie,
  });
  assert.equal(created.status, 201);
  const id = created.data.product.id;

  const edited = await api("PATCH", `/admin/products/${id}`, {
    body: { price: 6.5, name: "Test Edited Chew" },
    cookie,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.product.price, 6.5);
  assert.equal(edited.data.product.name, "Test Edited Chew");
  assert.equal(edited.data.product.quantity, 9);

  // Unchecking In Stock wipes the quantity to zero.
  const wiped = await api("PATCH", `/admin/products/${id}`, {
    body: { inStock: false },
    cookie,
  });
  assert.equal(wiped.status, 200);
  assert.equal(wiped.data.product.quantity, 0);
  assert.equal(wiped.data.product.inStock, false);

  // Re-checking with a quantity restores stock.
  const restocked = await api("PATCH", `/admin/products/${id}`, {
    body: { inStock: true, quantity: 4 },
    cookie,
  });
  assert.equal(restocked.data.product.quantity, 4);
  assert.equal(restocked.data.product.inStock, true);

  const anon = await api("PATCH", `/admin/products/${id}`, {
    body: { price: 1 },
  });
  assert.equal(anon.status, 403);
});

test("product deletion works but is blocked by order history", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const fresh = await api("POST", "/admin/products", {
    body: {
      name: "Test Deletable Toy",
      description: "Never ordered",
      price: 3,
      image: "/images/products/rope-toy.svg",
      category: "toys",
      quantity: 2,
      featured: false,
    },
    cookie,
  });
  const freshId = fresh.data.product.id;

  const ordered = await api("POST", "/admin/products", {
    body: {
      name: "Test Ordered Toy",
      description: "Has order history",
      price: 3,
      image: "/images/products/rope-toy.svg",
      category: "toys",
      quantity: 5,
      featured: false,
    },
    cookie,
  });
  const orderedId = ordered.data.product.id;
  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: orderedId, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "history@test.local",
    },
  });
  assert.equal(order.status, 201);

  const deleted = await api("DELETE", `/admin/products/${freshId}`, { cookie });
  assert.equal(deleted.status, 200);

  const blocked = await api("DELETE", `/admin/products/${orderedId}`, { cookie });
  assert.equal(blocked.status, 409);

  const list = await api("GET", "/admin/products", { cookie });
  assert.ok(!list.data.products.some((p) => p.id === freshId));
  assert.ok(list.data.products.some((p) => p.id === orderedId));
});

test("admins can edit and delete announcements", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const created = await api("POST", "/admin/announcements", {
    body: { title: "Temp Notice", body: "Original text" },
    cookie,
  });
  const id = created.data.announcement.id;

  const edited = await api("PATCH", `/admin/announcements/${id}`, {
    body: { body: "Edited text" },
    cookie,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.announcement.body, "Edited text");

  const deleted = await api("DELETE", `/admin/announcements/${id}`, { cookie });
  assert.equal(deleted.status, 200);

  const list = await api("GET", "/admin/announcements", { cookie });
  assert.ok(!list.data.announcements.some((a) => a.id === id));
});

test("events: admin CRUD, public read-only calendar queries", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const date = "2031-05-17";

  const anonCreate = await api("POST", "/admin/events", {
    body: { title: "Nope", description: "x", date, color: "teal" },
  });
  assert.equal(anonCreate.status, 403);

  const created = await api("POST", "/admin/events", {
    body: {
      title: "Test Market Day",
      description: "Booth by the fountain",
      location: "Town Square",
      date,
      color: "green",
    },
    cookie,
  });
  assert.equal(created.status, 201);
  const id = created.data.event.id;

  // Public month + day queries see it.
  const month = await api("GET", "/events?month=2031-05");
  assert.ok(month.data.events.some((e) => e.id === id));
  const day = await api("GET", `/events?date=${date}`);
  assert.equal(day.data.events.length, 1);
  assert.equal(day.data.events[0].color, "green");

  const otherDay = await api("GET", "/events?date=2031-05-18");
  assert.equal(otherDay.data.events.length, 0);

  // Edit moves the date and recolors the badge.
  const patched = await api("PATCH", `/admin/events/${id}`, {
    body: { date: "2031-06-02", color: "purple" },
    cookie,
  });
  assert.equal(patched.status, 200);
  const moved = await api("GET", "/events?date=2031-06-02");
  assert.equal(moved.data.events[0].color, "purple");

  const badColor = await api("PATCH", `/admin/events/${id}`, {
    body: { color: "hot-pink" },
    cookie,
  });
  assert.equal(badColor.status, 400);

  const deleted = await api("DELETE", `/admin/events/${id}`, { cookie });
  assert.equal(deleted.status, 200);
  const gone = await api("GET", "/events?date=2031-06-02");
  assert.equal(gone.data.events.length, 0);
});

test("pickup orders require an event; Next Event resolves to the nearest not-today", async () => {
  const { data: products } = await api("GET", "/products");
  const product = products.products.find((p) => p.variants.length === 0 && p.quantity >= 2);

  // Upcoming endpoint lists the seeded events for the dropdown.
  const upcoming = await api("GET", "/events?upcoming=true");
  assert.equal(upcoming.status, 200);
  assert.ok(upcoming.data.events.length >= 2);

  // Pickup without an event is rejected.
  const noEvent = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      guestEmail: "pickup@test.local",
    },
  });
  assert.equal(noEvent.status, 400);

  // "next" resolves server-side to the nearest upcoming event (not today):
  // the seeded Farmers Market, 3 days out.
  const nextOrder = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "pickup@test.local",
    },
  });
  assert.equal(nextOrder.status, 201);
  assert.equal(nextOrder.data.order.pickupEvent.title, "Farmers Market");

  // An explicit event id is honored.
  const expo = upcoming.data.events.find((e) => e.title === "Pet Expo");
  const explicit = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: expo.id,
      guestEmail: "pickup@test.local",
    },
  });
  assert.equal(explicit.status, 201);
  assert.equal(explicit.data.order.pickupEvent.id, expo.id);

  // A bogus event id is rejected.
  const bogus = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "not-a-real-event",
      guestEmail: "pickup@test.local",
    },
  });
  assert.equal(bogus.status, 409);
});

test("image uploads are admin-only, stored, and served back", async () => {
  // Smallest valid PNG (1x1 transparent).
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );

  const makeForm = (type, name) => {
    const fd = new FormData();
    fd.append("file", new Blob([pngBytes], { type }), name);
    return fd;
  };

  // Anonymous uploads are forbidden.
  const anon = await fetch(`${BASE}/api/admin/uploads`, {
    method: "POST",
    body: makeForm("image/png", "sneaky.png"),
  });
  assert.equal(anon.status, 403);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  // Non-image types are rejected.
  const badType = await fetch(`${BASE}/api/admin/uploads`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: makeForm("text/plain", "notes.txt"),
  });
  assert.equal(badType.status, 400);

  // A PNG uploads and is served back with the right content type.
  const uploaded = await fetch(`${BASE}/api/admin/uploads`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: makeForm("image/png", "product.png"),
  });
  assert.equal(uploaded.status, 201);
  const { url } = await uploaded.json();
  assert.match(url, /^\/api\/uploads\/[a-f0-9]{16}\.png$/);

  const served = await fetch(`${BASE}${url}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
  const body = Buffer.from(await served.arrayBuffer());
  assert.deepEqual(body, pngBytes);

  // Path traversal in the name is a 404, not a file read.
  const traversal = await fetch(`${BASE}/api/uploads/..%2F..%2Fpackage.json`);
  assert.equal(traversal.status, 404);
});

test("admins can create admin accounts with hardened passwords", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const anon = await api("POST", "/admin/users", {
    body: { name: "Sneaky", email: "sneaky@test.local", password: "password1" },
  });
  assert.equal(anon.status, 403);

  // Too short, and missing a number — both rejected.
  const short = await api("POST", "/admin/users", {
    body: { name: "Partner", email: "partner@test.local", password: "abc1234" },
    cookie,
  });
  assert.equal(short.status, 400);
  const noNumber = await api("POST", "/admin/users", {
    body: { name: "Partner", email: "partner@test.local", password: "abcdefgh" },
    cookie,
  });
  assert.equal(noNumber.status, 400);

  const created = await api("POST", "/admin/users", {
    body: { name: "Partner", email: "partner@test.local", password: "trusty-pup8" },
    cookie,
  });
  assert.equal(created.status, 201);
  assert.ok(!("password" in created.data.admin), "password never returned");

  // The new admin can log in immediately (pre-verified) and use admin APIs.
  const partnerCookie = await loginAs("partner@test.local", "trusty-pup8");
  assert.match(partnerCookie, /authjs\.session-token=/);
  const stats = await api("GET", "/admin/stats", { cookie: partnerCookie });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.stats.adminUsers >= 2);

  const list = await api("GET", "/admin/users", { cookie });
  assert.ok(list.data.admins.some((a) => a.email === "partner@test.local"));

  // Duplicate emails are rejected.
  const dupe = await api("POST", "/admin/users", {
    body: { name: "Partner", email: "partner@test.local", password: "trusty-pup8" },
    cookie,
  });
  assert.equal(dupe.status, 409);
});
