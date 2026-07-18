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
  const { name, isActive, email, note } = await request.json();

  const therapist = await prisma.therapist.update({
    where: { id },
    data: { name, isActive, email: email || null, note: note || null },
  });

  return NextResponse.json(therapist);
}
