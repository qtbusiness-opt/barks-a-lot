// Connection-string handling for container startup. Prisma Migrate needs
// a direct (non-pooled) connection — through a pooler its advisory lock
// times out with P1002 and the container never starts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { directDatabaseUrl, redactDatabaseUrl } from "../scripts/db-url.js";

const NEON_POOLED =
  "postgresql://neondb_owner:npg_secret123@ep-restless-heart-af0l1oyl-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const NEON_DIRECT =
  "postgresql://neondb_owner:npg_secret123@ep-restless-heart-af0l1oyl.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

test("a pooled Neon host becomes the direct host for migrations", () => {
  assert.equal(directDatabaseUrl(NEON_POOLED), NEON_DIRECT);
});

test("credentials, database and query params survive the rewrite", () => {
  const url = new URL(directDatabaseUrl(NEON_POOLED));
  assert.equal(url.username, "neondb_owner");
  assert.equal(url.password, "npg_secret123");
  assert.equal(url.pathname, "/neondb");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("channel_binding"), "require");
});

test("non-pooled connections are left untouched", () => {
  const compose = "postgresql://barks:pw@db:5432/barks";
  assert.equal(directDatabaseUrl(compose), compose);
  assert.equal(directDatabaseUrl(NEON_DIRECT), NEON_DIRECT);
});

test("an explicit DIRECT_DATABASE_URL wins over the derived one", () => {
  const explicit = "postgresql://someone:pw@other.example.com/db";
  assert.equal(directDatabaseUrl(NEON_POOLED, explicit), explicit);
});

test("unparseable or missing values are handed back, not thrown on", () => {
  assert.equal(directDatabaseUrl("not a url"), "not a url");
  assert.equal(directDatabaseUrl(""), "");
  assert.equal(directDatabaseUrl(undefined), undefined);
});

test("the password never survives into a log line", () => {
  const redacted = redactDatabaseUrl(NEON_POOLED);
  assert.ok(!redacted.includes("npg_secret123"), "password leaked into log");
  assert.ok(redacted.includes("neondb_owner"), "user is still useful context");
  assert.ok(
    redacted.includes("ep-restless-heart-af0l1oyl-pooler"),
    "host is still useful context"
  );
});

test("redaction handles passwordless and malformed values", () => {
  assert.ok(!redactDatabaseUrl("postgresql://db:5432/x").includes("***"));
  assert.equal(redactDatabaseUrl("garbage"), "(unparseable DATABASE_URL)");
  assert.equal(redactDatabaseUrl(undefined), "undefined");
});
