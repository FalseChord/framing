import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";

const prisma = new PrismaClient();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { name, signature } = await request.json();

  const user = await prisma.user.update({
    where: { id },
    data: { name, signature },
  });

  return NextResponse.json(user);
}
