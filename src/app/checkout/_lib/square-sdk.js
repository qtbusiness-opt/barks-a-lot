// Square Web Payments SDK. The app id is public by design (it only
// tokenizes cards in the browser); the secret access token lives
// server-side. Both ids come from /api/config at runtime (see
// lib/public-config.js). Without an app id the card form is skipped and
// the server skips charging too — payments simply aren't configured yet.
export function loadSquareSdk(appId) {
  const sdkUrl = appId.startsWith("sandbox-")
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";
  return new Promise((resolve, reject) => {
    if (window.Square) return resolve(window.Square);
    let script = document.querySelector(`script[src="${sdkUrl}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = sdkUrl;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.Square));
    script.addEventListener("error", () =>
      reject(new Error("Square SDK failed to load"))
    );
  });
}

// Tokenize the mounted card form (nothing is charged yet). Resolves to
// { payment: { token, card } } or { error } with the message to show.
export async function tokenizeCard(card) {
  try {
    const result = await card.tokenize();
    if (result.status !== "OK") {
      // Surface Square's own message — config problems (wrong
      // environment, mismatched location id) are only diagnosable
      // from it.
      console.error("[checkout] tokenize failed:", result.errors);
      return {
        error:
          result.errors?.map((e) => e.message).join(" ") ||
          "Please check your card details and try again.",
      };
    }
    return {
      payment: { token: result.token, card: result.details?.card ?? null },
    };
  } catch (err) {
    console.error("[checkout] tokenize threw:", err);
    return {
      error: err?.message
        ? `Payment form error: ${err.message}`
        : "Please check your card details and try again.",
    };
  }
}
