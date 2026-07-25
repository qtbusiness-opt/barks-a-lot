import { NextResponse } from "next/server";

// Browser-safe runtime configuration. NEXT_PUBLIC_* values are inlined
// into the client bundle at BUILD time, which breaks on container
// platforms like Cloud Run where env vars are set on the service at
// runtime — the bundle was built before they existed. This route reads
// them from the live process env instead, so runtime configuration just
// works. Everything returned here is public by design (the Square app id
// only tokenizes cards in the browser; the Maps key is referrer-locked).
//
// Bracket access is deliberate: the compiler statically replaces literal
// `process.env.NEXT_PUBLIC_*` expressions at build time, and we want the
// runtime values.
export const dynamic = "force-dynamic";

export async function GET() {
  const env = process.env;
  return NextResponse.json({
    squareAppId: env["SQUARE_APP_ID"] || env["NEXT_PUBLIC_SQUARE_APP_ID"] || "",
    squareLocationId:
      env["SQUARE_LOCATION_ID"] || env["NEXT_PUBLIC_SQUARE_LOCATION_ID"] || "",
    mapsApiKey:
      env["GOOGLE_MAPS_API_KEY"] ||
      env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"] ||
      "",
  });
}
