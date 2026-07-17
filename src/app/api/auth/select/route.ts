import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const { userId } = await request.json();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "找不到這個使用者" }, { status: 404 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.signature = user.signature;
  await session.save();

  return NextResponse.json({ ok: true });
}
