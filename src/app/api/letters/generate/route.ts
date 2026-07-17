import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { renderLetter, MissingFieldsError } from "@/lib/letters/render";
import { decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { templateId, fields, variant } = await request.json();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "找不到模板" }, { status: 404 });
  }

  let renderedBody: string;
  try {
    renderedBody = renderLetter({
      templateBody: template.body,
      requiredFields: decodeRequiredFields(template.requiredFields),
      fields,
      variant,
    });
  } catch (err) {
    if (err instanceof MissingFieldsError) {
      return NextResponse.json({ error: err.message, missingFields: err.missingFields }, { status: 400 });
    }
    throw err;
  }

  // Audit log intentionally excludes caseRef, recipient email, and the rendered body itself.
  await prisma.letterLog.create({
    data: { userId: session.userId, templateId: template.id },
  });

  return NextResponse.json({ renderedBody });
}
