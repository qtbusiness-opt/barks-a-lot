import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves admin-uploaded images from the database (Upload model). The
// strict name pattern (hex + known extension, set by the upload route)
// keeps lookups to values we generated ourselves.
export async function GET(_req, { params }) {
  const { name } = await params;

  const match = /^[a-f0-9]{16}\.(png|jpg|webp|gif)$/.exec(name ?? "");
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upload = await prisma.upload.findUnique({ where: { name } });
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(upload.data), {
    headers: {
      "Content-Type": upload.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
