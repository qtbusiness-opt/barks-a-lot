// Sliding-window rate limiter kept in process memory. Sufficient for a
// single-container deployment at this business's scale; swap for a shared
// store (e.g. Redis) if the app ever runs multiple instances.
const buckets = new Map();

const WINDOW_MS = 60 * 1000;
// Overridable so integration tests can exercise many auth/checkout calls
// without tripping the limiter meant for real traffic.
const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_MAX) || 5;

export function rateLimit(bucket, req) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  const timestamps = (buckets.get(key) || []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (timestamps.length >= MAX_ATTEMPTS) {
    buckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);

  // Bound memory: drop stale buckets once the map grows past a few thousand
  // keys (only reachable under sustained scanning traffic).
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }

  return true;
}
