import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return {
    ...template,
    requiredFields: decodeRequiredFields(template.requiredFields),
    variants: decodeRequiredFields(template.variants),
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { category, subject, body, variants, requiredFields } = await request.json();
  if (!category || !subject || !body) {
    return NextResponse.json({ error: "類別、標題、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const declaredVariants: string[] = variants && variants.length > 0 ? variants : ["不適用"];

  const template = await prisma.template.update({
    where: { id },
    data: {
      category,
      subject,
      body,
      variants: encodeRequiredFields(declaredVariants),
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields });
}
