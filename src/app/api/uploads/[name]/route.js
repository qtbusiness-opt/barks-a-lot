import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");

const TYPE_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// Serves admin-uploaded product images from the persistent data volume.
// The strict name pattern (hex + known extension, set by the upload
// route) doubles as path-traversal protection.
export async function GET(_req, { params }) {
  const { name } = await params;

  const match = /^([a-f0-9]{16})\.(png|jpg|webp|gif)$/.exec(name ?? "");
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readFile(path.join(UPLOADS_DIR, name));
    return new NextResponse(file, {
      headers: {
        "Content-Type": TYPE_BY_EXT[match[2]],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
