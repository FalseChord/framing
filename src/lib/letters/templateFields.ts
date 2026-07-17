const STANDARD_FIELDS = ["caseRef", "therapistName", "sessionDate", "variant"];
const HANDLEBARS_KEYWORDS = ["if", "else", "each", "eq", "unless", "this"];

export function findUndeclaredFields(body: string, requiredFields: string[]): string[] {
  const matches = body.matchAll(/{{\s*#?\/?\s*([a-zA-Z_][a-zA-Z0-9_]*)/g);
  const referenced = new Set<string>();

  for (const match of matches) {
    const name = match[1];
    if (!HANDLEBARS_KEYWORDS.includes(name)) {
      referenced.add(name);
    }
  }

  const known = new Set([...STANDARD_FIELDS, ...requiredFields]);
  return [...referenced].filter((name) => !known.has(name));
}
