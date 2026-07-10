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

const PORT = 4123;
const BASE = `http://localhost:${PORT}`;
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-admin-pw";

let server;
let dbDir;

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
  const env = {
    ...process.env,
    DATABASE_URL: `file:${path.join(dbDir, "test.db")}`,
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

test("register creates an account and a session", async () => {
  const res = await api("POST", "/auth/register", {
    body: { name: "Test User", email: "user@test.local", password: "secret123" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, "customer");
  assert.match(res.cookie, /^token=/);
});

test("register rejects invalid input", async () => {
  const res = await api("POST", "/auth/register", {
    body: { name: "", email: "not-an-email", password: "1" },
  });
  assert.equal(res.status, 400);
});

test("login rejects a wrong password", async () => {
  const res = await api("POST", "/auth/login", {
    body: { email: "user@test.local", password: "wrong-password" },
  });
  assert.equal(res.status, 401);
});

test("login succeeds with correct credentials", async () => {
  const res = await api("POST", "/auth/login", {
    body: { email: "user@test.local", password: "secret123" },
  });
  assert.equal(res.status, 200);
  assert.match(res.cookie, /^token=/);
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
  const login = await api("POST", "/auth/login", {
    body: { email: "user@test.local", password: "secret123" },
  });

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
    cookie: login.cookie,
  });
  assert.equal(created.status, 201);

  const history = await api("GET", "/orders", { cookie: login.cookie });
  assert.equal(history.status, 200);
  assert.ok(
    history.data.orders.some((o) => o.id === created.data.order.id),
    "order appears in the customer's history"
  );
});

test("admin API is forbidden for anonymous and customer sessions", async () => {
  const anon = await api("GET", "/admin/orders");
  assert.equal(anon.status, 403);

  const login = await api("POST", "/auth/login", {
    body: { email: "user@test.local", password: "secret123" },
  });
  const asCustomer = await api("GET", "/admin/orders", { cookie: login.cookie });
  assert.equal(asCustomer.status, 403);
});

test("admin can list orders and update status", async () => {
  const login = await api("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  assert.equal(login.status, 200);

  const list = await api("GET", "/admin/orders", { cookie: login.cookie });
  assert.equal(list.status, 200);
  assert.ok(list.data.orders.length >= 1);

  const orderId = list.data.orders[0].id;
  const patched = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "shipped" },
    cookie: login.cookie,
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.order.status, "shipped");

  const invalid = await api("PATCH", `/admin/orders/${orderId}`, {
    body: { status: "not-a-status" },
    cookie: login.cookie,
  });
  assert.equal(invalid.status, 400);
});
