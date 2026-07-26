import { NextResponse } from "next/server";

// Browser-safe runtime configuration. NEXT_PUBLIC_* values are inlined
// into bundles at BUILD time, which breaks on container platforms like
// Cloud Run where env vars are set on the service at runtime — the
// bundle was built before they existed. This route reads the live
// process env instead. Everything returned here is public by design
// (the Square app id only tokenizes cards in the browser; the Maps key
// is referrer-locked).
//
// The computed process.env[key] lookup is load-bearing: the compiler
// replaces any *literal* NEXT_PUBLIC_* access — even bracket form —
// with the build-time value whenever the variable is defined during
// `next build` (e.g. an empty Docker ARG), permanently freezing it. A
// runtime-computed key cannot be statically replaced.
export const dynamic = "force-dynamic";

function runtimeEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

export async function GET() {
  return NextResponse.json({
    squareAppId: runtimeEnv("SQUARE_APP_ID", "NEXT_PUBLIC_SQUARE_APP_ID"),
    squareLocationId: runtimeEnv(
      "SQUARE_LOCATION_ID",
      "NEXT_PUBLIC_SQUARE_LOCATION_ID"
    ),
    mapsApiKey: runtimeEnv(
      "GOOGLE_MAPS_API_KEY",
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
    ),
  });
}
