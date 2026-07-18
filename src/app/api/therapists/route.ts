import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
  const therapists = await prisma.therapist.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(therapists);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "姓名為必填" }, { status: 400 });
  }

  const therapist = await prisma.therapist.create({ data: { name } });
  return NextResponse.json(therapist, { status: 201 });
}
