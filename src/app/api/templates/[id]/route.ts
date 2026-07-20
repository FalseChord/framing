import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return {
    ...template,
    requiredFields: decodeRequiredFields(template.requiredFields),
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { category, variantLabel, subject, body, requiredFields } = await request.json();
  if (!category || !subject || !body) {
    return NextResponse.json({ error: "類別、標題、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const declaredVariantLabel: string = variantLabel?.trim() ? variantLabel.trim() : "不適用";

  let template: Template;
  try {
    template = await prisma.template.update({
      where: { id },
      data: {
        category,
        variantLabel: declaredVariantLabel,
        subject,
        body,
        requiredFields: encodeRequiredFields(declaredFields),
        updatedById: session.userId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "這個類別已經有同名的變體了，請換個名稱或改用編輯" },
        { status: 400 }
      );
    }
    throw err;
  }

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields });
}
