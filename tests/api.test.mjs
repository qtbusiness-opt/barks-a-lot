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
  // Spawn the next binary directly (not via npx) so server.pid is the
  // real server process and the after() SIGTERM actually stops it —
  // otherwise a leaked server on this port poisons the next run.
  server = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "dev", "--port", String(PORT)],
    { env, stdio: "ignore" }
  );

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

// Exact stock counts are stripped from the public catalog, so tests read
// them through the admin endpoint.
async function adminCatalog() {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const res = await api("GET", "/admin/products", { cookie });
  return res.data.products;
}

async function adminStock(productId) {
  const products = await adminCatalog();
  return products.find((p) => p.id === productId);
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
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length === 0 && p.quantity >= 2);

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

  const after = await adminStock(product.id);
  assert.equal(after.quantity, product.quantity - 2);
});

test("shipping orders are rejected while the store is pickup-only", async () => {
  const { data: products } = await api("GET", "/products");
  // Even a complete, well-formed shipping order is refused: launch is
  // pickup-only (SHIPPING_ENABLED is off).
  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: products.products[0].id, quantity: 1 }],
      fulfillmentType: "shipping",
      address: "1 Test St",
      city: "Boise",
      state: "ID",
      zip: "83701",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /pickup/i);
});

test("ordering more than available stock is rejected and nothing is written", async () => {
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length === 0 && p.quantity >= 1);

  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: product.quantity + 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(res.status, 409);

  const after = await adminStock(product.id);
  assert.equal(after.quantity, product.quantity);
});

test("logged-in customer order is linked to the account", async () => {
  const cookie = await loginAs("user@test.local", "secret123");
  assert.notEqual(cookie, "");

  const { data: products } = await api("GET", "/products");
  const product = products.products.find(
    (p) => p.variants.length === 0 && p.inStock
  );

  const created = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
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
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length > 0);
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
  const after = await adminStock(product.id);
  const afterVariant = after.variants.find((v) => v.id === variant.id);
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

test("public catalog exposes availability booleans, never stock counts", async () => {
  const { data } = await api("GET", "/products");

  const drop = data.products.find((p) => p.limitedQuantity != null);
  assert.ok(drop, "seeded limited drop is visible while in its window");

  for (const p of data.products) {
    assert.equal(p.quantity, undefined, `${p.name} leaks its stock count`);
    assert.equal(typeof p.inStock, "boolean");
    for (const v of p.variants) {
      assert.equal(v.quantity, undefined, `${p.name} variant leaks stock`);
      assert.equal(typeof v.inStock, "boolean");
    }
  }

  // The detail endpoint is sanitized the same way.
  const detail = await api("GET", `/products/${data.products[0].id}`);
  assert.equal(detail.data.product.quantity, undefined);
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
  const product = products.products.find((p) => p.variants.length === 0 && p.inStock);

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
      // Pickup-only wording: "delivered" reads as "has been picked up".
      (n) => n.email === email && n.message.includes("picked up")
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

test("pickup orders require an event; Next Event resolves to the nearest selectable event", async () => {
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length === 0 && p.quantity >= 2);

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

  // "next" resolves server-side to the nearest event still open for
  // pickup: the seeded Farmers Market, 3 days out.
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

test("customers can reset a forgotten password end to end", async () => {
  const reg = await api("POST", "/auth/register", {
    body: { name: "Forgetful", email: "forgetful@test.local", password: "original6" },
  });
  assert.equal(reg.status, 201);
  const verifyToken = new URL(reg.data.devVerificationUrl).searchParams.get("token");
  await api("POST", "/auth/verify", { body: { token: verifyToken } });

  // Unknown emails get the same answer — no account probing.
  const unknown = await api("POST", "/auth/forgot-password", {
    body: { email: "nobody@test.local" },
  });
  assert.equal(unknown.status, 200);
  assert.ok(!unknown.data.devResetUrl);

  const forgot = await api("POST", "/auth/forgot-password", {
    body: { email: "forgetful@test.local" },
  });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.data.devResetUrl, "dev reset link returned");
  const resetToken = new URL(forgot.data.devResetUrl).searchParams.get("token");

  // Too-short password rejected; token survives the failed attempt.
  const weak = await api("POST", "/auth/reset-password", {
    body: { token: resetToken, password: "tiny" },
  });
  assert.equal(weak.status, 400);

  const reset = await api("POST", "/auth/reset-password", {
    body: { token: resetToken, password: "brandnew7" },
  });
  assert.equal(reset.status, 200);

  // Token is single-use, the old password is dead, the new one works.
  const reuse = await api("POST", "/auth/reset-password", {
    body: { token: resetToken, password: "another99" },
  });
  assert.equal(reuse.status, 400);
  assert.equal(await loginAs("forgetful@test.local", "original6"), "");
  assert.match(
    await loginAs("forgetful@test.local", "brandnew7"),
    /authjs\.session-token=/
  );
});

test("admin password resets enforce the hardened policy", async () => {
  const forgot = await api("POST", "/auth/forgot-password", {
    body: { email: ADMIN_EMAIL },
  });
  const resetToken = new URL(forgot.data.devResetUrl).searchParams.get("token");

  // 8 chars but no digit — rejected for admins.
  const weak = await api("POST", "/auth/reset-password", {
    body: { token: resetToken, password: "lettersonly" },
  });
  assert.equal(weak.status, 400);

  const reset = await api("POST", "/auth/reset-password", {
    body: { token: resetToken, password: ADMIN_PASSWORD },
  });
  assert.equal(reset.status, 200);
});

test("admins can look up customers, send resets, and delete accounts", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const reg = await api("POST", "/auth/register", {
    body: { name: "Lookup Target", email: "lookup@test.local", password: "secret123" },
  });
  const verifyToken = new URL(reg.data.devVerificationUrl).searchParams.get("token");
  await api("POST", "/auth/verify", { body: { token: verifyToken } });

  // Give them an order so deletion has history to preserve.
  const { data: products } = await api("GET", "/products");
  const product = products.products.find((p) => p.variants.length === 0 && p.inStock);
  const customerCookie = await loginAs("lookup@test.local", "secret123");
  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
    },
    cookie: customerCookie,
  });
  assert.equal(order.status, 201);

  // Anonymous lookups are forbidden; admin search finds the account.
  const anon = await api("GET", "/admin/customers?q=lookup");
  assert.equal(anon.status, 403);
  const found = await api("GET", "/admin/customers?q=lookup", { cookie });
  assert.equal(found.status, 200);
  const target = found.data.customers.find((c) => c.email === "lookup@test.local");
  assert.ok(target);
  assert.equal(target._count.orders, 1);

  // Admin-triggered reset answers with the customer's email.
  const sent = await api("POST", `/admin/customers/${target.id}`, { cookie });
  assert.equal(sent.status, 200);
  assert.match(sent.data.message, /lookup@test\.local/);

  // Admins can't be deleted through this endpoint.
  const admins = await api("GET", "/admin/users", { cookie });
  const adminDelete = await api(
    "DELETE",
    `/admin/customers/${admins.data.admins[0].id}`,
    { cookie }
  );
  assert.equal(adminDelete.status, 404);

  // Deleting the customer keeps their order as a guest record.
  const deleted = await api("DELETE", `/admin/customers/${target.id}`, { cookie });
  assert.equal(deleted.status, 200);
  assert.equal(await loginAs("lookup@test.local", "secret123"), "");

  const orders = await api("GET", "/admin/orders", { cookie });
  const kept = orders.data.orders.find(
    (o) => o.confirmationNumber === order.data.order.confirmationNumber
  );
  assert.ok(kept, "order survives customer deletion");
  assert.equal(kept.user, null);
  assert.equal(kept.guestEmail, "lookup@test.local");
});

test("profile: name edit, order summary; no addresses recorded while pickup-only", async () => {
  const anon = await api("GET", "/profile");
  assert.equal(anon.status, 401);

  // Fresh verified customer.
  const reg = await api("POST", "/auth/register", {
    body: { name: "Profile Tester", email: "profile@test.local", password: "secret123" },
  });
  const verifyToken = new URL(reg.data.devVerificationUrl).searchParams.get("token");
  await api("POST", "/auth/verify", { body: { token: verifyToken } });
  const cookie = await loginAs("profile@test.local", "secret123");

  // Needs two units: this test places the same order twice.
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length === 0 && p.quantity >= 2);
  // Address fields sent alongside a pickup order must NOT be recorded —
  // the store is pickup-only and collects no customer addresses.
  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      address: "77 Book St",
      city: "Meridian",
      state: "ID",
      zip: "83646",
    },
    cookie,
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.order.address, null, "pickup order stores no address");

  const profile = await api("GET", "/profile", { cookie });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.email, "profile@test.local");
  assert.equal(profile.data.orderSummary.pending, 1);
  assert.equal(profile.data.orderSummary.total, 1);
  assert.equal(profile.data.addresses.length, 0, "address book stays empty");

  const repeat = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
    },
    cookie,
  });
  assert.equal(repeat.status, 201);
  const again = await api("GET", "/profile", { cookie });
  assert.equal(again.data.addresses.length, 0);
  assert.equal(again.data.orderSummary.total, 2);

  // Name is editable.
  const renamed = await api("PATCH", "/profile", {
    body: { name: "Renamed Tester" },
    cookie,
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.user.name, "Renamed Tester");

  // The dormant address routes still enforce auth + ownership: an id that
  // doesn't belong to the caller (or doesn't exist) is a 404.
  const foreign = await api("DELETE", "/profile/addresses/nonexistent", { cookie });
  assert.equal(foreign.status, 404);
});

test("customer can cancel an order until pickup; stock is restored", async () => {
  const cookie = await loginAs("user@test.local", "secret123");
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length === 0 && p.quantity >= 2);

  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 2 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
    },
    cookie,
  });
  assert.equal(order.status, 201);
  const orderId = order.data.order.id;

  const afterOrder = await adminStock(product.id);
  assert.equal(afterOrder.quantity, product.quantity - 2);

  // Anonymous callers can't cancel; another account's order id is a 404.
  const anon = await api("POST", `/orders/${orderId}/cancel`);
  assert.equal(anon.status, 401);
  const adminCookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const foreign = await api("POST", `/orders/${orderId}/cancel`, {
    cookie: adminCookie,
  });
  assert.equal(foreign.status, 404);

  // The owner's cancellation restocks and records a notification.
  const cancelled = await api("POST", `/orders/${orderId}/cancel`, { cookie });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.order.status, "cancelled");

  const afterCancel = await adminStock(product.id);
  assert.equal(afterCancel.quantity, product.quantity);

  const notifications = await api("GET", "/admin/notifications", {
    cookie: adminCookie,
  });
  assert.ok(
    notifications.data.notifications.some(
      (n) => n.orderId === orderId && n.message.includes("cancelled")
    ),
    "cancellation notification recorded"
  );

  // Cancelling twice is a conflict, and admins can't resurrect it.
  const again = await api("POST", `/orders/${orderId}/cancel`, { cookie });
  assert.equal(again.status, 409);
  const resurrect = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "pending" },
    cookie: adminCookie,
  });
  assert.equal(resurrect.status, 409);
});

test("picked-up orders can't be cancelled by the customer", async () => {
  const cookie = await loginAs("user@test.local", "secret123");
  const { data: products } = await api("GET", "/products");
  const product = products.products.find(
    (p) => p.variants.length === 0 && p.inStock
  );

  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
    },
    cookie,
  });
  assert.equal(order.status, 201);
  const orderId = order.data.order.id;

  const adminCookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const delivered = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "delivered" },
    cookie: adminCookie,
  });
  assert.equal(delivered.status, 200);

  const refused = await api("POST", `/orders/${orderId}/cancel`, { cookie });
  assert.equal(refused.status, 409);

  // An admin cancelling a picked-up order is bookkeeping only — the
  // items already left the booth, so stock must not change.
  const before = await adminStock(product.id);
  const adminCancel = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "cancelled" },
    cookie: adminCookie,
  });
  assert.equal(adminCancel.status, 200);
  const after = await adminStock(product.id);
  assert.equal(after.quantity, before.quantity);
});

test("admin cancellation of an active order restores stock", async () => {
  const catalog = await adminCatalog();
  const product = catalog.find((p) => p.variants.length === 0 && p.quantity >= 1);

  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "cancel-restock@test.local",
    },
  });
  assert.equal(order.status, 201);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const cancelled = await api("PATCH", `/admin/orders/${order.data.order.id}`, {
    body: { status: "cancelled" },
    cookie,
  });
  assert.equal(cancelled.status, 200);

  const after = await adminStock(product.id);
  assert.equal(after.quantity, product.quantity);
});

test("customers can delete their own account; orders survive as guest records", async () => {
  const reg = await api("POST", "/auth/register", {
    body: { name: "Self Delete", email: "selfdelete@test.local", password: "secret123" },
  });
  const token = new URL(reg.data.devVerificationUrl).searchParams.get("token");
  await api("POST", "/auth/verify", { body: { token } });
  const cookie = await loginAs("selfdelete@test.local", "secret123");

  const { data: products } = await api("GET", "/products");
  const product = products.products.find(
    (p) => p.variants.length === 0 && p.inStock
  );
  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
    },
    cookie,
  });
  assert.equal(order.status, 201);

  // Anonymous callers get 401; admins can't self-delete through this route.
  const anon = await api("DELETE", "/profile");
  assert.equal(anon.status, 401);
  const adminCookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const asAdmin = await api("DELETE", "/profile", { cookie: adminCookie });
  assert.equal(asAdmin.status, 403);

  // Self-deletion kills the login...
  const deleted = await api("DELETE", "/profile", { cookie });
  assert.equal(deleted.status, 200);
  assert.equal(await loginAs("selfdelete@test.local", "secret123"), "");

  // ...but the order survives as a guest record for bookkeeping.
  const orders = await api("GET", "/admin/orders", { cookie: adminCookie });
  const kept = orders.data.orders.find(
    (o) => o.confirmationNumber === order.data.order.confirmationNumber
  );
  assert.ok(kept, "order survives account deletion");
  assert.equal(kept.user, null);
  assert.equal(kept.guestEmail, "selfdelete@test.local");
});

test("same-day pickup respects the two-hour cutoff before the event ends", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const pad2 = (n) => String(n).padStart(2, "0");
  const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  // The event must end after it starts.
  const badTimes = await api("POST", "/admin/events", {
    body: {
      title: "Backwards Event",
      description: "end before start",
      date: today,
      startTime: "14:00",
      endTime: "09:00",
    },
    cookie,
  });
  assert.equal(badTimes.status, 400);

  // Needs several units — this test places up to three orders. The admin
  // catalog also lists expired drops, so stick to always-available items.
  const catalog = await adminCatalog();
  const product = catalog.find(
    (p) =>
      p.variants.length === 0 &&
      p.quantity >= 5 &&
      !p.limitedQuantity &&
      !p.availableFrom &&
      !p.availableUntil
  );

  // A same-day event already inside the two-hour cutoff can't be chosen.
  const closingSoon = new Date(now.getTime() + 30 * 60 * 1000);
  const closed = await api("POST", "/admin/events", {
    body: {
      title: "Closing Soon Market",
      description: "wraps up in half an hour",
      date: today,
      startTime: "00:00",
      endTime: hhmm(closingSoon),
    },
    cookie,
  });
  assert.equal(closed.status, 201);
  assert.equal(closed.data.event.endTime, hhmm(closingSoon));

  const refused = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: closed.data.event.id,
      guestEmail: "cutoff@test.local",
    },
  });
  assert.equal(refused.status, 409);

  // "next" skips it and lands on a still-open event.
  const viaNextClosed = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "cutoff@test.local",
    },
  });
  assert.equal(viaNextClosed.status, 201, JSON.stringify(viaNextClosed.data));
  assert.notEqual(viaNextClosed.data.order.pickupEvent.id, closed.data.event.id);

  // A same-day event more than two hours from closing can be chosen
  // manually AND becomes the "next" event. (Skipped when the test runs
  // within 4h of midnight — such an event can't exist today.)
  const openEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  if (openEnd.getDate() === now.getDate()) {
    const open = await api("POST", "/admin/events", {
      body: {
        title: "Open Today Market",
        description: "plenty of time left",
        date: today,
        startTime: "00:01",
        endTime: hhmm(openEnd),
      },
      cookie,
    });
    assert.equal(open.status, 201);

    const manual = await api("POST", "/orders", {
      body: {
        items: [{ productId: product.id, quantity: 1 }],
        fulfillmentType: "pickup",
        pickupEventId: open.data.event.id,
        guestEmail: "cutoff@test.local",
      },
    });
    assert.equal(manual.status, 201);

    const viaNext = await api("POST", "/orders", {
      body: {
        items: [{ productId: product.id, quantity: 1 }],
        fulfillmentType: "pickup",
        pickupEventId: "next",
        guestEmail: "cutoff@test.local",
      },
    });
    assert.equal(viaNext.status, 201);
    assert.equal(viaNext.data.order.pickupEvent.id, open.data.event.id);

    // Clean up so later tests' "next" stays deterministic.
    await api("DELETE", `/admin/events/${open.data.event.id}`, { cookie });
  }
  await api("DELETE", `/admin/events/${closed.data.event.id}`, { cookie });
});

test("admin manages categories; storefront lists and products follow", async () => {
  const pub = await api("GET", "/categories");
  assert.equal(pub.status, 200);
  assert.ok(pub.data.categories.some((c) => c.slug === "treats"));

  const anon = await api("POST", "/admin/categories", {
    body: { name: "Bandanas" },
  });
  assert.equal(anon.status, 403);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api("POST", "/admin/categories", {
    body: { name: "Bandanas", icon: "🧣" },
    cookie,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.category.slug, "bandanas");

  // Duplicate names (same slug) are rejected.
  const dupe = await api("POST", "/admin/categories", {
    body: { name: "bandanas" },
    cookie,
  });
  assert.equal(dupe.status, 409);

  // Products must use a real category slug.
  const badProduct = await api("POST", "/admin/products", {
    body: {
      name: "Orphan Product",
      description: "no such category",
      price: 5,
      image: "/images/products/squeaky-bone.svg",
      category: "no-such-category",
      quantity: 1,
    },
    cookie,
  });
  assert.equal(badProduct.status, 400);

  const product = await api("POST", "/admin/products", {
    body: {
      name: "Test Bandana",
      description: "created in the new category",
      price: 12,
      image: "/images/products/squeaky-bone.svg",
      category: "bandanas",
      quantity: 3,
    },
    cookie,
  });
  assert.equal(product.status, 201);

  // A category with products can't be deleted.
  const blocked = await api(
    "DELETE",
    `/admin/categories/${created.data.category.id}`,
    { cookie }
  );
  assert.equal(blocked.status, 409);

  // Renaming cascades the new slug to the category's products.
  const renamed = await api(
    "PATCH",
    `/admin/categories/${created.data.category.id}`,
    { body: { name: "Neckwear", icon: "🧣" }, cookie }
  );
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.category.slug, "neckwear");
  const after = await adminStock(product.data.product.id);
  assert.equal(after.category, "neckwear");

  // Freeing the category allows deletion, and the public list follows.
  await api("DELETE", `/admin/products/${product.data.product.id}`, { cookie });
  const gone = await api(
    "DELETE",
    `/admin/categories/${created.data.category.id}`,
    { cookie }
  );
  assert.equal(gone.status, 200);
  const finalPub = await api("GET", "/categories");
  assert.ok(!finalPub.data.categories.some((c) => c.slug === "neckwear"));
});

test("product gallery images and item details round-trip through the APIs", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api("POST", "/admin/products", {
    body: {
      name: "Gallery Biscuit",
      description: "has extra photos and ingredients",
      price: 6,
      image: "/images/products/squeaky-bone.svg",
      images: [
        "/images/products/plush-duck.svg",
        "/images/products/chicken-jerky.svg",
      ],
      itemDetails: "Oats, pumpkin, cinnamon",
      category: "treats",
      quantity: 3,
    },
    cookie,
  });
  assert.equal(created.status, 201);
  const id = created.data.product.id;
  assert.deepEqual(created.data.product.images, [
    "/images/products/plush-duck.svg",
    "/images/products/chicken-jerky.svg",
  ]);

  // The public detail endpoint returns the parsed array and the details.
  const pub = await api("GET", `/products/${id}`);
  assert.deepEqual(pub.data.product.images, [
    "/images/products/plush-duck.svg",
    "/images/products/chicken-jerky.svg",
  ]);
  assert.equal(pub.data.product.itemDetails, "Oats, pumpkin, cinnamon");

  // Clearing both via PATCH works ("" and [] mean "unset").
  const cleared = await api("PATCH", `/admin/products/${id}`, {
    body: { images: [], itemDetails: "" },
    cookie,
  });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.data.product.images, []);
  assert.equal(cleared.data.product.itemDetails, null);

  await api("DELETE", `/admin/products/${id}`, { cookie });
});
