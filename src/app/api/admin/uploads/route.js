import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Uploads are stored in the database (Upload model), NOT on disk —
// Cloud Run's filesystem is ephemeral, and files added to public/ at
// runtime aren't served by the production build anyway. They're served
// back via /api/uploads/[name].

const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Images must be PNG, JPEG, WebP, or GIF" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Images must be 5 MB or smaller" },
        { status: 400 }
      );
    }

    const name = `${randomBytes(8).toString("hex")}.${ext}`;
    await prisma.upload.create({
      data: {
        name,
        mime: file.type,
        data: Buffer.from(await file.arrayBuffer()),
      },
    });

    console.info(`[admin] image uploaded ${name} by=${auth.userId}`);
    return NextResponse.json({ url: `/api/uploads/${name}` }, { status: 201 });
  } catch (err) {
    console.error("[admin] upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
