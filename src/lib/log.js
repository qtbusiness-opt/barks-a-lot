import { prisma } from "@/lib/prisma";

// Pulls the client IP from the proxy headers (same order as the rate
// limiter). Accepts a Headers object or a plain request.
export function clientIp(reqOrHeaders) {
  const headers = reqOrHeaders?.headers ?? reqOrHeaders;
  const get = (k) =>
    typeof headers?.get === "function" ? headers.get(k) : headers?.[k];
  return (
    get("x-forwarded-for")?.split(",")[0]?.trim() ||
    get("x-real-ip") ||
    null
  );
}

// Records a structured event to the LogEvent table AND mirrors it to
// stdout/stderr so Docker log drivers still capture it. Best-effort: a
// logging failure must never break the request that triggered it.
export async function logEvent({
  level = "info",
  category,
  event,
  message,
  email = null,
  userId = null,
  path = null,
  ip = null,
}) {
  const line = `[${category}] ${event}${email ? ` email=${email}` : ""}${path ? ` path=${path}` : ""} — ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);

  try {
    await prisma.logEvent.create({
      data: { level, category, event, message, email, userId, path, ip },
    });
  } catch (err) {
    // Don't recurse into logEvent — just note it to the console.
    console.error("[log] failed to persist event:", err?.message);
  }
}
