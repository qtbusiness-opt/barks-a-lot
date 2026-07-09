import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user });
}

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("token", "", { maxAge: 0, path: "/" });
  return response;
}
