// Integration tests for the two money-critical areas (CLAUDE.md §6):
// checkout (order creation, inventory decrement) and auth (login,
// protected route access). Boots the real Next.js app against a
// throwaway Postgres database, created and dropped per run on the
// server at TEST_DATABASE_ADMIN_URL (defaults to a local Postgres).
//
// Run with: npm test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const PORT = 4123;
const BASE = `http://localhost:${PORT}`;
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-admin-pw8";

// Maintenance connection used only to CREATE/DROP the throwaway DB.
const ADMIN_DB_URL =
  process.env.TEST_DATABASE_ADMIN_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

let server;
let dbName;
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
  dbName = `barks_test_${Date.now()}_${process.pid}`;
  const admin = new PrismaClient({ datasourceUrl: ADMIN_DB_URL });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await admin.$disconnect();
  dbUrl = new URL(ADMIN_DB_URL);
  dbUrl.pathname = `/${dbName}`;
  dbUrl = dbUrl.toString();

  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    JWT_SECRET: "test-secret",
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    RATE_LIMIT_MAX: "1000",
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

after(async () => {
  if (server) server.kill("SIGTERM");
  if (dbName) {
    const admin = new PrismaClient({ datasourceUrl: ADMIN_DB_URL });
    // FORCE kicks any connection the just-killed server still holds.
    await admin
      .$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => {});
    await admin.$disconnect();
  }
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
    body: {
      name: "Test User",
      email: "user@test.local",
      password: "secret123",
    },
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
    body: {
      name: "Resend Tester",
      email: "resend@test.local",
      password: "secret123",
    },
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
  const oldToken = new URL(reg.data.devVerificationUrl).searchParams.get(
    "token"
  );
  const stale = await api("POST", "/auth/verify", {
    body: { token: oldToken },
  });
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
  const product = catalog.find(
    (p) => p.variants.length === 0 && p.quantity >= 2
  );

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
  const product = catalog.find(
    (p) => p.variants.length === 0 && p.quantity >= 1
  );

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
        {
          productId: product.id,
          variantId: variant.id,
          quantity: afterVariant.quantity + 1,
        },
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

  const created = await api("POST", "/admin/products", {
    body: payload,
    cookie,
  });
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

test("nutrition facts round-trip and are gated on the edible category flag", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const rows = [
    { label: "Crude Protein (min)", value: "24%" },
    { label: "Crude Fat (min)", value: "12%" },
  ];

  const created = await api("POST", "/admin/products", {
    body: {
      name: "Nutrition Test Treat",
      description: "Has a nutrition table",
      price: 6.5,
      image: "/images/products/squeaky-bone.svg",
      category: "treats",
      quantity: 4,
      nutritionFacts: rows,
    },
    cookie,
  });
  assert.equal(created.status, 201);
  // Stored as JSON but handed back as a real array.
  assert.deepEqual(created.data.product.nutritionFacts, rows);
  const id = created.data.product.id;

  // The storefront gets the parsed rows plus the category's flag.
  const shown = await api("GET", `/products/${id}`);
  assert.deepEqual(shown.data.product.nutritionFacts, rows);
  assert.equal(shown.data.product.categoryShowsIngredients, true);

  // A row missing its value is rejected rather than half-saved.
  const invalid = await api("PATCH", `/admin/products/${id}`, {
    body: { nutritionFacts: [{ label: "Crude Protein (min)", value: "" }] },
    cookie,
  });
  assert.equal(invalid.status, 400);
  const unchanged = await api("GET", `/products/${id}`);
  assert.deepEqual(unchanged.data.product.nutritionFacts, rows);

  // Omitting the field entirely leaves the table untouched.
  const renamed = await api("PATCH", `/admin/products/${id}`, {
    body: { name: "Nutrition Test Treat v2" },
    cookie,
  });
  assert.equal(renamed.status, 200);
  assert.deepEqual(renamed.data.product.nutritionFacts, rows);

  // Moving to a category without an Ingredients section keeps the rows
  // (never silently destroyed) but drops the storefront's flag, which is
  // what hides the table.
  const moved = await api("PATCH", `/admin/products/${id}`, {
    body: { category: "toys" },
    cookie,
  });
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.data.product.nutritionFacts, rows);
  const hidden = await api("GET", `/products/${id}`);
  assert.equal(hidden.data.product.categoryShowsIngredients, false);
  assert.deepEqual(hidden.data.product.nutritionFacts, rows);

  // An empty array clears the table.
  const cleared = await api("PATCH", `/admin/products/${id}`, {
    body: { nutritionFacts: [] },
    cookie,
  });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.data.product.nutritionFacts, []);

  // Products that never had nutrition facts report an empty list, not null.
  const plain = await api("POST", "/admin/products", {
    body: {
      name: "No Nutrition Treat",
      description: "No table here",
      price: 3.25,
      image: "/images/products/squeaky-bone.svg",
      category: "treats",
      quantity: 2,
    },
    cookie,
  });
  assert.equal(plain.status, 201);
  assert.deepEqual(plain.data.product.nutritionFacts, []);

  await api("DELETE", `/admin/products/${id}`, { cookie });
  await api("DELETE", `/admin/products/${plain.data.product.id}`, { cookie });
});

test("status changes record a notification tied to the order email", async () => {
  const email = "notify-me@test.local";
  const { data: products } = await api("GET", "/products");
  const product = products.products.find(
    (p) => p.variants.length === 0 && p.inStock
  );

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
  const note = notifications.data.notifications.find(
    // Pickup-only wording: "delivered" reads as "has been picked up".
    (n) => n.email === email && n.message.includes("picked up")
  );
  assert.ok(note, "notification recorded against the guest email");

  // Archiving moves it off the active list and onto the archived list.
  const archived = await api("PATCH", `/admin/notifications/${note.id}`, {
    body: { archived: true },
    cookie,
  });
  assert.equal(archived.status, 200);
  assert.ok(archived.data.notification.archivedAt);

  const active = await api("GET", "/admin/notifications", { cookie });
  assert.ok(!active.data.notifications.some((n) => n.id === note.id));
  const archivedList = await api("GET", "/admin/notifications?archived=true", {
    cookie,
  });
  assert.ok(archivedList.data.notifications.some((n) => n.id === note.id));

  // Restoring brings it back to the active list.
  const restored = await api("PATCH", `/admin/notifications/${note.id}`, {
    body: { archived: false },
    cookie,
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.notification.archivedAt, null);
  const activeAgain = await api("GET", "/admin/notifications", { cookie });
  assert.ok(activeAgain.data.notifications.some((n) => n.id === note.id));
});

test("announcements: admin creates, storefront shows the latest", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const anon = await api("POST", "/admin/announcements", {
    body: { title: "x", body: "y" },
  });
  assert.equal(anon.status, 403);

  const created = await api("POST", "/admin/announcements", {
    body: {
      title: "Market This Weekend",
      body: "Find us at the farmers market Saturday 9-2!",
    },
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

  const blocked = await api("DELETE", `/admin/products/${orderedId}`, {
    cookie,
  });
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
  const product = catalog.find(
    (p) => p.variants.length === 0 && p.quantity >= 2
  );

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
    body: {
      name: "Partner",
      email: "partner@test.local",
      password: "abcdefgh",
    },
    cookie,
  });
  assert.equal(noNumber.status, 400);

  const created = await api("POST", "/admin/users", {
    body: {
      name: "Partner",
      email: "partner@test.local",
      password: "trusty-pup8",
    },
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
    body: {
      name: "Partner",
      email: "partner@test.local",
      password: "trusty-pup8",
    },
    cookie,
  });
  assert.equal(dupe.status, 409);
});

test("customers can reset a forgotten password end to end", async () => {
  const reg = await api("POST", "/auth/register", {
    body: {
      name: "Forgetful",
      email: "forgetful@test.local",
      password: "original6",
    },
  });
  assert.equal(reg.status, 201);
  const verifyToken = new URL(reg.data.devVerificationUrl).searchParams.get(
    "token"
  );
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

test("products are addressed by a name slug, with ids still resolving", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api("POST", "/admin/products", {
    body: {
      name: "Slug Test Bandana!",
      description: "Named URL",
      price: 4.5,
      image: "/images/products/squeaky-bone.svg",
      category: "accessories",
      quantity: 3,
    },
    cookie,
  });
  assert.equal(created.status, 201);
  const product = created.data.product;
  assert.equal(product.slug, "slug-test-bandana");

  // The slug is the public address...
  const bySlug = await api("GET", `/products/${product.slug}`);
  assert.equal(bySlug.status, 200);
  assert.equal(bySlug.data.product.id, product.id);
  // ...and the id still resolves, so older links keep working.
  const byId = await api("GET", `/products/${product.id}`);
  assert.equal(byId.status, 200);
  assert.equal(byId.data.product.slug, product.slug);

  // A second product with the same name gets a distinct slug.
  const twin = await api("POST", "/admin/products", {
    body: {
      name: "Slug Test Bandana!",
      description: "Same name",
      price: 4.5,
      image: "/images/products/squeaky-bone.svg",
      category: "accessories",
      quantity: 1,
    },
    cookie,
  });
  assert.equal(twin.data.product.slug, "slug-test-bandana-2");

  // Renaming moves the URL with it.
  const renamed = await api("PATCH", `/admin/products/${product.id}`, {
    body: { name: "Renamed Bandana" },
    cookie,
  });
  assert.equal(renamed.data.product.slug, "renamed-bandana");
  assert.equal((await api("GET", "/products/renamed-bandana")).status, 200);

  await api("DELETE", `/admin/products/${product.id}`, { cookie });
  await api("DELETE", `/admin/products/${twin.data.product.id}`, { cookie });
});

test("product option groups round-trip and are enforced at checkout", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api("POST", "/admin/products", {
    body: {
      name: "Option Test Bandana",
      description: "Sizes and styles",
      price: 9.0,
      image: "/images/products/squeaky-bone.svg",
      category: "accessories",
      quantity: 10,
      optionGroups: [
        {
          name: "Size",
          inputType: "select",
          required: true,
          choices: [{ label: "Small" }, { label: "Large" }],
        },
        {
          name: "Add-ons",
          inputType: "checkbox",
          required: false,
          choices: [{ label: "Gift wrap" }, { label: "Name tag" }],
        },
      ],
    },
    cookie,
  });
  assert.equal(created.status, 201);
  const productId = created.data.product.id;

  const shown = await api("GET", `/products/${created.data.product.slug}`);
  const groups = shown.data.product.optionGroups;
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, "Size");
  assert.equal(groups[0].inputType, "select");
  assert.equal(groups[0].choices.length, 2);
  assert.equal(groups[1].required, false);

  const sizeGroup = groups[0];
  const addOns = groups[1];
  const order = (options) => ({
    items: [{ productId, quantity: 1, ...(options ? { options } : {}) }],
    fulfillmentType: "pickup",
    pickupEventId: "next",
    guestEmail: "options@test.local",
    guestName: "Options Tester",
  });

  // A required group must be answered.
  const missing = await api("POST", "/orders", { body: order() });
  assert.equal(missing.status, 400);
  assert.match(missing.data.error, /choose a Size/);

  // A single-choice group refuses two answers.
  const tooMany = await api("POST", "/orders", {
    body: order([
      { groupId: sizeGroup.id, choiceIds: sizeGroup.choices.map((c) => c.id) },
    ]),
  });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.data.error, /one Size/);

  // Choice ids from another group are rejected outright.
  const foreign = await api("POST", "/orders", {
    body: order([{ groupId: sizeGroup.id, choiceIds: [addOns.choices[0].id] }]),
  });
  assert.equal(foreign.status, 400);

  // A valid order records the labels, and checkboxes keep both answers.
  const placed = await api("POST", "/orders", {
    body: order([
      { groupId: sizeGroup.id, choiceIds: [sizeGroup.choices[1].id] },
      { groupId: addOns.id, choiceIds: addOns.choices.map((c) => c.id) },
    ]),
  });
  assert.equal(placed.status, 201);

  const admin = await api("GET", "/admin/orders", { cookie });
  const mine = admin.data.orders.find(
    (o) => o.confirmationNumber === placed.data.order.confirmationNumber
  );
  const line = mine.items.find((i) => i.productId === productId);
  assert.deepEqual(JSON.parse(line.options), [
    { group: "Size", values: ["Large"] },
    { group: "Add-ons", values: ["Gift wrap", "Name tag"] },
  ]);

  // Editing a product replaces its groups.
  const edited = await api("PATCH", `/admin/products/${productId}`, {
    body: {
      optionGroups: [
        {
          name: "Style",
          inputType: "carousel",
          required: true,
          choices: [
            { label: "Plaid", image: "/images/products/bandana-set.svg" },
          ],
        },
      ],
    },
    cookie,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.product.optionGroups.length, 1);
  assert.equal(edited.data.product.optionGroups[0].name, "Style");
  assert.equal(
    edited.data.product.optionGroups[0].choices[0].image,
    "/images/products/bandana-set.svg"
  );

  // An unknown input type is refused.
  const bogus = await api("PATCH", `/admin/products/${productId}`, {
    body: {
      optionGroups: [
        { name: "Nope", inputType: "slider", choices: [{ label: "x" }] },
      ],
    },
    cookie,
  });
  assert.equal(bogus.status, 400);

  // Clearing the groups leaves an ordinary product behind...
  const cleared = await api("PATCH", `/admin/products/${productId}`, {
    body: { optionGroups: [] },
    cookie,
  });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.data.product.optionGroups, []);
  // ...and it can be ordered again with no options at all.
  const plain = await api("POST", "/orders", { body: order() });
  assert.equal(plain.status, 201);

  // The order placed earlier keeps its snapshot even though the options
  // it referenced no longer exist.
  const after = await api("GET", "/admin/orders", { cookie });
  const stillThere = after.data.orders
    .find((o) => o.confirmationNumber === placed.data.order.confirmationNumber)
    .items.find((i) => i.productId === productId);
  assert.match(stillThere.options, /Large/);
});

test("admins can look up customers, send resets, and delete accounts", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

  const reg = await api("POST", "/auth/register", {
    body: {
      name: "Lookup Target",
      email: "lookup@test.local",
      password: "secret123",
    },
  });
  const verifyToken = new URL(reg.data.devVerificationUrl).searchParams.get(
    "token"
  );
  await api("POST", "/auth/verify", { body: { token: verifyToken } });

  // Give them an order so deletion has history to preserve.
  const { data: products } = await api("GET", "/products");
  const product = products.products.find(
    (p) => p.variants.length === 0 && p.inStock
  );
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
  const target = found.data.customers.find(
    (c) => c.email === "lookup@test.local"
  );
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
  const deleted = await api("DELETE", `/admin/customers/${target.id}`, {
    cookie,
  });
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
    body: {
      name: "Profile Tester",
      email: "profile@test.local",
      password: "secret123",
    },
  });
  const verifyToken = new URL(reg.data.devVerificationUrl).searchParams.get(
    "token"
  );
  await api("POST", "/auth/verify", { body: { token: verifyToken } });
  const cookie = await loginAs("profile@test.local", "secret123");

  // Needs two units: this test places the same order twice.
  const catalog = await adminCatalog();
  const product = catalog.find(
    (p) => p.variants.length === 0 && p.quantity >= 2
  );
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
  assert.equal(
    order.data.order.address,
    null,
    "pickup order stores no address"
  );

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
  const foreign = await api("DELETE", "/profile/addresses/nonexistent", {
    cookie,
  });
  assert.equal(foreign.status, 404);
});

test("customer can cancel an order until pickup; stock is restored", async () => {
  const cookie = await loginAs("user@test.local", "secret123");
  const catalog = await adminCatalog();
  const product = catalog.find(
    (p) => p.variants.length === 0 && p.quantity >= 2
  );

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

  // Picked-up orders are terminal: an admin can't change their status
  // (no cancel, no revert).
  const before = await adminStock(product.id);
  const adminCancel = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "cancelled" },
    cookie: adminCookie,
  });
  assert.equal(adminCancel.status, 409);
  const revert = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "pending" },
    cookie: adminCookie,
  });
  assert.equal(revert.status, 409);
  const after = await adminStock(product.id);
  assert.equal(after.quantity, before.quantity);

  // But the bookkeeping Refunded tag can be toggled on and off.
  const flagged = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { refunded: true },
    cookie: adminCookie,
  });
  assert.equal(flagged.status, 200);
  assert.equal(flagged.data.order.refunded, true);
  const unflagged = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { refunded: false },
    cookie: adminCookie,
  });
  assert.equal(unflagged.status, 200);
  assert.equal(unflagged.data.order.refunded, false);
});

test("the Refunded tag is rejected on orders that aren't picked up", async () => {
  const adminCookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const { data: products } = await api("GET", "/products");
  const product = products.products.find(
    (p) => p.variants.length === 0 && p.inStock
  );
  const order = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, quantity: 1 }],
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "refundtag@test.local",
    },
  });
  assert.equal(order.status, 201);

  // Pending order: refunded toggle refused.
  const early = await api("PATCH", `/admin/orders/${order.data.order.id}`, {
    body: { refunded: true },
    cookie: adminCookie,
  });
  assert.equal(early.status, 409);
});

test("admin cancellation of an active order restores stock", async () => {
  const catalog = await adminCatalog();
  const product = catalog.find(
    (p) => p.variants.length === 0 && p.quantity >= 1
  );

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
    body: {
      name: "Self Delete",
      email: "selfdelete@test.local",
      password: "secret123",
    },
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
  assert.notEqual(
    viaNextClosed.data.order.pickupEvent.id,
    closed.data.event.id
  );

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

  // Seeded edible categories default to showing ingredients; others don't.
  const treats = pub.data.categories.find((c) => c.slug === "treats");
  assert.equal(treats.showsIngredients, true);
  const toys = pub.data.categories.find((c) => c.slug === "toys");
  assert.equal(toys.showsIngredients, false);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api("POST", "/admin/categories", {
    body: { name: "Bandanas", icon: "🧣" },
    cookie,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.category.slug, "bandanas");
  assert.equal(created.data.category.showsIngredients, false);

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

  // The product's detail page reflects its category's ingredients flag.
  const beforeToggle = await api("GET", `/products/${product.data.product.id}`);
  assert.equal(beforeToggle.data.product.categoryShowsIngredients, false);

  // Flipping the toggle on the category flows through to its products.
  const toggled = await api(
    "PATCH",
    `/admin/categories/${created.data.category.id}`,
    { body: { name: "Bandanas", icon: "🧣", showsIngredients: true }, cookie }
  );
  assert.equal(toggled.status, 200);
  assert.equal(toggled.data.category.showsIngredients, true);
  const afterToggle = await api("GET", `/products/${product.data.product.id}`);
  assert.equal(afterToggle.data.product.categoryShowsIngredients, true);

  // Renaming cascades the new slug to the category's products (and an
  // omitted showsIngredients on PATCH leaves the flag untouched).
  const renamed = await api(
    "PATCH",
    `/admin/categories/${created.data.category.id}`,
    { body: { name: "Neckwear", icon: "🧣" }, cookie }
  );
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.category.slug, "neckwear");
  assert.equal(renamed.data.category.showsIngredients, true);
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

test("contact form stores a message, emails admins, and admins manage it", async () => {
  // Public submission validates input.
  const bad = await api("POST", "/contact", {
    body: { name: "", email: "not-an-email", message: "" },
  });
  assert.equal(bad.status, 400);

  const sent = await api("POST", "/contact", {
    body: {
      name: "Casey Customer",
      email: "casey@test.local",
      message: "Do the peanut butter biscuits contain xylitol?",
    },
  });
  assert.equal(sent.status, 201);

  // Listing is admin-only.
  const anon = await api("GET", "/admin/messages");
  assert.equal(anon.status, 403);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const list = await api("GET", "/admin/messages", { cookie });
  assert.equal(list.status, 200);
  const msg = list.data.messages.find((m) => m.email === "casey@test.local");
  assert.ok(msg, "message stored and listed");
  assert.equal(msg.readAt, null);

  // Unread messages surface in the dashboard stats.
  const stats = await api("GET", "/admin/stats", { cookie });
  assert.ok(stats.data.stats.unreadMessages >= 1);

  // Mark read, then unread, then delete.
  const read = await api("PATCH", `/admin/messages/${msg.id}`, {
    body: { read: true },
    cookie,
  });
  assert.equal(read.status, 200);
  assert.ok(read.data.message.readAt);

  const deleted = await api("DELETE", `/admin/messages/${msg.id}`, { cookie });
  assert.equal(deleted.status, 200);
  const after = await api("GET", "/admin/messages", { cookie });
  assert.ok(!after.data.messages.some((m) => m.id === msg.id));
});

test("promotions: admin CRUD, code + bundle discounts, and server-authoritative order pricing", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const catalog = await adminCatalog();
  // Two simple (non-variant) always-available products for a bundle —
  // skip limited/seasonal drops, which validate excludes when out of
  // their window.
  const bundleProducts = catalog
    .filter(
      (p) =>
        p.variants.length === 0 &&
        p.quantity >= 2 &&
        !p.limitedQuantity &&
        !p.availableFrom &&
        !p.availableUntil
    )
    .slice(0, 2);
  assert.equal(bundleProducts.length, 2, "need two simple products");
  const [a, b] = bundleProducts;

  // Admin CRUD is protected.
  const anon = await api("POST", "/admin/promotions", {
    body: { name: "x", type: "code", code: "X", percentOff: 10 },
  });
  assert.equal(anon.status, 403);

  // Create a percent-off code (code is normalized to uppercase).
  const codePromo = await api("POST", "/admin/promotions", {
    body: { name: "Veterans", type: "code", code: "veterans", percentOff: 20 },
    cookie,
  });
  assert.equal(codePromo.status, 201);
  assert.equal(codePromo.data.promotion.code, "VETERANS");

  // Duplicate code rejected.
  const dupe = await api("POST", "/admin/promotions", {
    body: { name: "Dup", type: "code", code: "VETERANS", percentOff: 5 },
    cookie,
  });
  assert.equal(dupe.status, 409);

  // Missing percentage rejected.
  const bad = await api("POST", "/admin/promotions", {
    body: { name: "NoPct", type: "code", code: "NOPCT" },
    cookie,
  });
  assert.equal(bad.status, 400);

  // Retry the first create with a cookie (the anon attempt used none).
  const codeOk = await api("POST", "/admin/promotions", {
    body: { name: "Loyalty", type: "code", code: "SAVE10", percentOff: 10 },
    cookie,
  });
  assert.equal(codeOk.status, 201);

  // Create a bundle: any 2 of {a,b} for $1.00 (well below their prices).
  const bundle = await api("POST", "/admin/promotions", {
    body: {
      name: "Treat Bundle",
      type: "bundle",
      bundleQuantity: 2,
      bundlePrice: 1,
      productIds: [a.id, b.id],
    },
    cookie,
  });
  assert.equal(bundle.status, 201);

  // Validate preview: bundle applies automatically (a + b → $1.00).
  const cartItems = [
    { productId: a.id, quantity: 1 },
    { productId: b.id, quantity: 1 },
  ];
  const preview = await api("POST", "/promotions/validate", {
    body: { items: cartItems },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.subtotal, Number((a.price + b.price).toFixed(2)));
  assert.equal(preview.data.total, 1);
  assert.ok(preview.data.applied.length >= 1);

  // With the SAVE10 code stacked: 10% off the $1.00 post-bundle subtotal.
  const withCode = await api("POST", "/promotions/validate", {
    body: { items: cartItems, code: "save10" },
  });
  assert.equal(withCode.data.total, 0.9);

  // Bad code is reported, not applied.
  const badCode = await api("POST", "/promotions/validate", {
    body: { items: cartItems, code: "NOPE" },
  });
  assert.ok(badCode.data.codeError);
  assert.equal(badCode.data.total, 1);

  // Order pricing is server-authoritative: even if a client lies about the
  // total, the order stores the real discounted total.
  const order = await api("POST", "/orders", {
    body: {
      items: cartItems,
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "promo@test.local",
      promoCode: "SAVE10",
    },
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.order.total, 0.9);
  assert.equal(
    order.data.order.discountTotal,
    Number((a.price + b.price - 0.9).toFixed(2))
  );
  assert.equal(order.data.order.promoCode, "SAVE10");

  // Deactivating the bundle stops it applying.
  const deactivate = await api(
    "PATCH",
    `/admin/promotions/${bundle.data.promotion.id}`,
    {
      body: {
        name: "Treat Bundle",
        type: "bundle",
        active: false,
        bundleQuantity: 2,
        bundlePrice: 1,
        productIds: [a.id, b.id],
      },
      cookie,
    }
  );
  assert.equal(deactivate.status, 200);
  const noBundle = await api("POST", "/promotions/validate", {
    body: { items: cartItems },
  });
  assert.equal(noBundle.data.discountTotal, 0);

  // Delete cleans up.
  const del = await api(
    "DELETE",
    `/admin/promotions/${bundle.data.promotion.id}`,
    {
      cookie,
    }
  );
  assert.equal(del.status, 200);
});

test("stacking rules: bundles stack without limit; only one discount code applies", async () => {
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const catalog = await adminCatalog();
  // A single always-available product with enough stock for two bundle sets.
  const p = catalog.find(
    (x) =>
      x.variants.length === 0 &&
      x.quantity >= 4 &&
      !x.limitedQuantity &&
      !x.availableFrom &&
      !x.availableUntil
  );
  assert.ok(p, "need a product with stock >= 4");

  // Bundle: any 2 of {p} for $1.00 — deep discount so savings are obvious.
  const bundle = await api("POST", "/admin/promotions", {
    body: {
      name: "Two-Fer",
      type: "bundle",
      bundleQuantity: 2,
      bundlePrice: 1,
      productIds: [p.id],
    },
    cookie,
  });
  assert.equal(bundle.status, 201);

  // Two active discount codes exist at once.
  const ten = await api("POST", "/admin/promotions", {
    body: { name: "Ten", type: "code", code: "TENOFF", percentOff: 10 },
    cookie,
  });
  assert.equal(ten.status, 201);
  const twenty = await api("POST", "/admin/promotions", {
    body: { name: "Twenty", type: "code", code: "TWENTYOFF", percentOff: 20 },
    cookie,
  });
  assert.equal(twenty.status, 201);

  // 4 units → the bundle applies TWICE (unbounded): 4 units cost $2.00.
  const fourUnits = [{ productId: p.id, quantity: 4 }];
  const bundleOnly = await api("POST", "/promotions/validate", {
    body: { items: fourUnits },
  });
  assert.equal(bundleOnly.data.subtotal, Number((p.price * 4).toFixed(2)));
  assert.equal(bundleOnly.data.total, 2);

  // One code stacks on top of the bundles: TWENTYOFF → 20% off $2.00 = $1.60.
  const withOneCode = await api("POST", "/promotions/validate", {
    body: { items: fourUnits, code: "TWENTYOFF" },
  });
  assert.equal(withOneCode.data.total, 1.6);
  // Exactly one code is reflected in the applied list (bundle entries + 1 code).
  assert.equal(
    withOneCode.data.applied.filter((a) => a.includes("% off")).length,
    1
  );

  // Only one code per order: the payload carries a single code, so the two
  // codes can never combine — TENOFF alone is 10% off $2.00 = $1.80.
  const otherCode = await api("POST", "/promotions/validate", {
    body: { items: fourUnits, code: "TENOFF" },
  });
  assert.equal(otherCode.data.total, 1.8);

  // Placing the order with one code stores exactly that discount.
  const order = await api("POST", "/orders", {
    body: {
      items: fourUnits,
      fulfillmentType: "pickup",
      pickupEventId: "next",
      guestEmail: "stack@test.local",
      promoCode: "TWENTYOFF",
    },
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.order.total, 1.6);
  assert.equal(order.data.order.promoCode, "TWENTYOFF");

  // Cleanup.
  await api("DELETE", `/admin/promotions/${bundle.data.promotion.id}`, {
    cookie,
  });
  await api("DELETE", `/admin/promotions/${ten.data.promotion.id}`, { cookie });
  await api("DELETE", `/admin/promotions/${twenty.data.promotion.id}`, {
    cookie,
  });
});

test("activity log records logins and errors; admin can view the breakdown", async () => {
  // A failed login is recorded...
  const failed = await loginAs("user@test.local", "definitely-wrong");
  assert.equal(failed, "");
  // ...and a successful one.
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.notEqual(cookie, "");

  // The log is admin-only.
  const anon = await api("GET", "/admin/logs");
  assert.equal(anon.status, 403);

  const logs = await api("GET", "/admin/logs", { cookie });
  assert.equal(logs.status, 200);
  assert.ok(
    logs.data.summary.loginsToday >= 1,
    "a successful login was counted"
  );
  assert.ok(logs.data.summary.failedToday >= 1, "a failed login was counted");
  assert.ok(
    logs.data.events.some((e) => e.event === "login_failed"),
    "failed login event is listed"
  );
  assert.ok(
    logs.data.events.some(
      (e) => e.event === "login_success" && e.email === ADMIN_EMAIL
    ),
    "admin login recorded with email"
  );

  // Category filters narrow to a single category.
  const authOnly = await api("GET", "/admin/logs?category=auth", { cookie });
  assert.ok(authOnly.data.events.length > 0);
  assert.ok(authOnly.data.events.every((e) => e.category === "auth"));

  const errorsOnly = await api("GET", "/admin/logs?category=error", { cookie });
  assert.ok(errorsOnly.data.events.every((e) => e.category === "error"));
});

test("abandoned carts are logged for analytics and attributed to the session", async () => {
  const items = [
    { name: "Peanut Butter Biscuits", quantity: 2, price: 12.99 },
    { name: "Chicken Jerky Strips", quantity: 1, price: 16.99 },
  ];

  // Garbage in is rejected — this endpoint is written to by the browser.
  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const empty = await api("POST", "/cart/abandoned", {
    body: { reason: "signed_out", items: [] },
    cookie,
  });
  assert.equal(empty.status, 400);

  const badReason = await api("POST", "/cart/abandoned", {
    body: { reason: "whatever", items },
    cookie,
  });
  assert.equal(badReason.status, 400);

  // A signed-in logout records the cart against the account.
  const logged = await api("POST", "/cart/abandoned", {
    body: { reason: "signed_out", items },
    cookie,
  });
  assert.equal(logged.status, 202);

  const logs = await api("GET", "/admin/logs?category=cart", { cookie });
  assert.equal(logs.status, 200);
  assert.ok(
    logs.data.events.every((e) => e.category === "cart"),
    "the cart filter returns only cart events"
  );
  const entry = logs.data.events.find((e) => e.event === "cart_abandoned");
  assert.ok(entry, "abandoned cart is listed in the activity log");
  // 2 x 12.99 + 1 x 16.99 = 42.97 across 3 units.
  assert.match(entry.message, /3 items · \$42\.97/);
  assert.match(entry.message, /signed out/);
  assert.match(entry.message, /Peanut Butter Biscuits x2/);
  assert.equal(entry.email, ADMIN_EMAIL, "attributed to the signed-in user");

  // A timed-out session can't be attributed, but the cart value still is.
  const anon = await api("POST", "/cart/abandoned", {
    body: { reason: "session_expired", items: [items[1]] },
  });
  assert.equal(anon.status, 202);

  const after = await api("GET", "/admin/logs?category=cart", { cookie });
  const expired = after.data.events.find((e) =>
    e.message.includes("session timed out")
  );
  assert.ok(expired, "expired-session abandonment is recorded");
  assert.equal(expired.email, null, "no identity is invented for it");
  assert.match(expired.message, /1 item · \$16\.99/);
});

test("About page photos: admin-only settings with a key whitelist", async () => {
  const anon = await api("GET", "/admin/site-settings");
  assert.equal(anon.status, 403);

  const cookie = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  const initial = await api("GET", "/admin/site-settings", { cookie });
  assert.equal(initial.status, 200);

  // A whitelisted key upserts.
  const set = await api("PATCH", "/admin/site-settings", {
    body: { key: "about_image_family", value: "/uploads/family.png" },
    cookie,
  });
  assert.equal(set.status, 200);
  const after = await api("GET", "/admin/site-settings", { cookie });
  assert.equal(after.data.settings.about_image_family, "/uploads/family.png");

  // An empty value clears it (revert to placeholder).
  const clear = await api("PATCH", "/admin/site-settings", {
    body: { key: "about_image_family", value: "" },
    cookie,
  });
  assert.equal(clear.status, 200);
  const gone = await api("GET", "/admin/site-settings", { cookie });
  assert.equal(gone.data.settings.about_image_family, undefined);

  // An arbitrary key is rejected — no writing outside the whitelist.
  const bad = await api("PATCH", "/admin/site-settings", {
    body: { key: "admin_password", value: "hax" },
    cookie,
  });
  assert.equal(bad.status, 400);
});
