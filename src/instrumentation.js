// Next.js global error hook. Fires for uncaught errors thrown while
// rendering routes or handling API requests, so they land in the admin
// activity log without instrumenting every catch block.
export async function onRequestError(err, request) {
  // Only the Node.js runtime has DB access; skip edge/other runtimes.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { logEvent, clientIp } = await import("@/lib/log");
    await logEvent({
      level: "error",
      category: "error",
      event: "server_error",
      message: err?.message ? String(err.message).slice(0, 500) : "Unknown error",
      path: request?.path ?? null,
      ip: clientIp(request),
    });
  } catch {
    // Never let error logging throw.
  }
}
