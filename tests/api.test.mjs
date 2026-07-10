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
const ADMIN_PASSWORD = "test-admin-pw";

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

test("register creates an account", async () => {
  const res = await api("POST", "/auth/register", {
    body: { name: "Test User", email: "user@test.local", password: "secret123" },
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, "customer");
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
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(noVariant.status, 400);

  const variant = product.variants.find((v) => v.quantity >= 2);
  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
      fulfillmentType: "pickup",
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
      guestEmail: "guest@test.local",
    },
  });
  assert.equal(purchase.status, 409);
});
