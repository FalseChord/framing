import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return { ...template, requiredFields: decodeRequiredFields(template.requiredFields) };
}

export async function GET() {
  const templates = await prisma.template.findMany({ orderBy: { category: "asc" } });
  return NextResponse.json(templates.map(serializeTemplate));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { category, variant, body, requiredFields } = await request.json();
  if (!category || !variant || !body) {
    return NextResponse.json({ error: "類別、方案變體、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const template = await prisma.template.create({
    data: {
      category,
      variant,
      body,
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(body, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields }, { status: 201 });
}
