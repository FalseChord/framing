import Handlebars from "handlebars";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export interface RenderInput {
  templateBody: string;
  requiredFields: string[];
  fields: Record<string, string>;
  variant: string;
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

  const compiled = Handlebars.compile(input.templateBody, { noEscape: true });
  return compiled({ ...input.fields, variant: input.variant });
}
