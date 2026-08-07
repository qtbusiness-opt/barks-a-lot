// Connection-string helpers shared by the startup script.
//
// Two different connections are needed in production:
//
//  - The app runs through a connection POOLER (Neon's `-pooler` host).
//    Serverless instances open and drop connections constantly, so
//    pooling is what keeps Postgres from running out of backends.
//  - Prisma Migrate must NOT use the pooler. It takes a session-level
//    advisory lock (`SELECT pg_advisory_lock(...)`) to serialize
//    concurrent deploys, and PgBouncer in transaction mode doesn't keep
//    a session pinned, so the lock never lands and migrate dies with
//    "P1002 ... Timed out trying to acquire a postgres advisory lock".

// The direct (non-pooled) connection to run migrations against. An
// explicit DIRECT_DATABASE_URL always wins; otherwise Neon's pooled host
// is the direct host with "-pooler" appended to the endpoint id, so
// dropping it gets us there. Anything else (local Postgres, compose) has
// no pooler and is returned unchanged.
function directDatabaseUrl(rawUrl, explicitDirectUrl) {
  if (explicitDirectUrl) return explicitDirectUrl;
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.includes("-pooler.")) return rawUrl;
    url.hostname = url.hostname.replace("-pooler.", ".");
    return url.toString();
  } catch {
    // Not a URL we can parse — hand it back untouched and let Prisma
    // report the real problem.
    return rawUrl;
  }
}

// Connection strings carry the database password, so never log one as-is:
// container logs are readable by anyone with project access.
function redactDatabaseUrl(rawUrl) {
  if (!rawUrl) return String(rawUrl);
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

module.exports = { directDatabaseUrl, redactDatabaseUrl };
