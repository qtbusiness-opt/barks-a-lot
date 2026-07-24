"use client";

// Browser-safe config (Square app/location ids, Maps key) resolved at
// runtime from /api/config, so values set on the deployment environment
// (e.g. Cloud Run service env vars) work without a rebuild. Build-time
// NEXT_PUBLIC_* values, when present, act as fallbacks — the literal
// process.env references below are inlined by the compiler.
const BUILD_TIME = {
  squareAppId: process.env.NEXT_PUBLIC_SQUARE_APP_ID || "",
  squareLocationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || "",
  mapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
};

let configPromise = null;

export function getPublicConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/config")
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then((cfg) => ({
        squareAppId: cfg.squareAppId || BUILD_TIME.squareAppId,
        squareLocationId: cfg.squareLocationId || BUILD_TIME.squareLocationId,
        mapsApiKey: cfg.mapsApiKey || BUILD_TIME.mapsApiKey,
      }));
  }
  return configPromise;
}
