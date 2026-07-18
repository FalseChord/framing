import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";

const prisma = new PrismaClient();

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { name, signature } = await request.json();
  if (!name || !signature) {
    return NextResponse.json({ error: "姓名與簽名代號皆為必填" }, { status: 400 });
  }

  const user = await prisma.user.create({ data: { name, signature } });
  return NextResponse.json(user, { status: 201 });
}
