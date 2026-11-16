import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { MissingFieldsError } from "@/lib/letters/render";
import { decodeRequiredFields } from "@/lib/letters/requiredFields";
import { generateLetter } from "@/lib/letters/generateLetter";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.signature) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { templateId, fields, slotCount, includeLine } = await request.json();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "找不到模板" }, { status: 404 });
  }

  try {
    const letter = generateLetter({
      template: {
        subject: template.subject,
        body: template.body,
        requiredFields: decodeRequiredFields(template.requiredFields),
      },
      fields,
      slotCount,
      includeLine: Boolean(includeLine),
      operatorSignature: session.signature,
    });
    return NextResponse.json(letter);
  } catch (err) {
    if (err instanceof MissingFieldsError) {
      return NextResponse.json({ error: err.message, missingFields: err.missingFields }, { status: 400 });
    }
    throw err;
  }
}
