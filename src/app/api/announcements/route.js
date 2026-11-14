import { NextResponse } from "next/server";
import { getLatestAnnouncement } from "@/lib/storefront";

// Public: the latest announcement, shown as a banner on the storefront.
export async function GET() {
  const announcement = await getLatestAnnouncement();

  return NextResponse.json({ announcement });
}
