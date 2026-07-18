import Handlebars from "handlebars";
import { resolveVariantBlocks } from "./variantBlocks";
import { resolveSlotBlocks } from "./slotBlocks";

export interface RenderInput {
  templateBody: string;
  requiredFields: string[];
  fields: Record<string, string>;
  variant: string;
  slotCount?: number;
}

export class MissingFieldsError extends Error {
  missingFields: string[];

  constructor(missingFields: string[]) {
    super(`缺少必填欄位: ${missingFields.join(", ")}`);
    this.name = "MissingFieldsError";
    this.missingFields = missingFields;
  }
}

export function renderLetter(input: RenderInput): string {
  const missing = input.requiredFields.filter((field) => !input.fields[field]?.trim());
  if (missing.length > 0) {
    throw new MissingFieldsError(missing);
  }

  let text = resolveVariantBlocks(input.templateBody, input.variant);
  text = resolveSlotBlocks(text, input.slotCount ?? -1);

  const compiled = Handlebars.compile(text, { noEscape: true });
  return compiled({ ...input.fields, variant: input.variant });
}
