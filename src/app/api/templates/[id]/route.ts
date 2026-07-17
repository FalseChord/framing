import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return { ...template, requiredFields: decodeRequiredFields(template.requiredFields) };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { category, variant, body, requiredFields } = await request.json();
  const declaredFields: string[] = requiredFields ?? [];

  const template = await prisma.template.update({
    where: { id },
    data: {
      category,
      variant,
      body,
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(body, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields });
}
