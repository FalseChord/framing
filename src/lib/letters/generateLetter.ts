import { renderLetter } from "./render";
import { toHighlightedHtml, stripHighlightMarkers } from "./highlightMarkup";
import { buildSignatureBlock } from "./signature";

export interface LetterTemplateContent {
  subject: string;
  body: string;
  requiredFields: string[];
  optionalFields?: string[];
}

export interface GenerateLetterInput {
  template: LetterTemplateContent;
  fields: Record<string, string>;
  slotCount?: number;
  includeLine: boolean;
  operatorSignature: string;
}

export interface GeneratedLetter {
  renderedSubject: string;
  renderedBodyHtml: string;
  renderedBodyPlain: string;
}

// The whole subject+body+signature pipeline in one pure function, shared by the
// full app's /api/letters/generate route and the static (no-database) build so
// the two can never drift apart. Throws MissingFieldsError like renderLetter.
export function generateLetter(input: GenerateLetterInput): GeneratedLetter {
  const { template, fields, slotCount } = input;
  const renderedSubject = renderLetter({
    templateBody: template.subject,
    requiredFields: template.requiredFields,
    optionalFields: template.optionalFields,
    fields,
    slotCount,
  });
  const renderedBody = renderLetter({
    templateBody: template.body,
    requiredFields: template.requiredFields,
    optionalFields: template.optionalFields,
    fields,
    slotCount,
  });

  const signatureBlock = buildSignatureBlock({
    operatorSignature: input.operatorSignature,
    includeLine: input.includeLine,
  });
  const fullBody = `${renderedBody}\n\n${signatureBlock}`;

  return {
    renderedSubject: stripHighlightMarkers(renderedSubject),
    renderedBodyHtml: toHighlightedHtml(fullBody),
    renderedBodyPlain: stripHighlightMarkers(fullBody),
  };
}
