import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { renderLetter, MissingFieldsError } from "@/lib/letters/render";
import { decodeRequiredFields } from "@/lib/letters/requiredFields";
import { toHighlightedHtml, stripHighlightMarkers } from "@/lib/letters/highlightMarkup";
import { buildSignatureBlock } from "@/lib/letters/signature";

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

  const requiredFields = decodeRequiredFields(template.requiredFields);

  let renderedSubject: string;
  let renderedBody: string;
  try {
    renderedSubject = renderLetter({ templateBody: template.subject, requiredFields, fields, slotCount });
    renderedBody = renderLetter({ templateBody: template.body, requiredFields, fields, slotCount });
  } catch (err) {
    if (err instanceof MissingFieldsError) {
      return NextResponse.json({ error: err.message, missingFields: err.missingFields }, { status: 400 });
    }
    throw err;
  }

  const signatureBlock = buildSignatureBlock({
    operatorSignature: session.signature,
    includeLine: Boolean(includeLine),
  });
  const fullBody = `${renderedBody}\n\n${signatureBlock}`;

  return NextResponse.json({
    renderedSubject: stripHighlightMarkers(renderedSubject),
    renderedBodyHtml: toHighlightedHtml(fullBody),
    renderedBodyPlain: stripHighlightMarkers(fullBody),
  });
}
