import type { TemplateItem, TherapistItem } from "@/components/GenerateLetterForm";

// TemplateItem plus the body — structurally a LetterTemplateContent for generateLetter().
export interface StaticTemplate extends TemplateItem {
  body: string;
}

export interface StaticOperator {
  id: string;
  name: string;
  signature: string;
}

// Shape of static/src/letters-data.json, written by scripts/export-static-data.ts
// from the local SQLite database at build time. The file is gitignored — real
// template/therapist data only ever leaves this machine as the deployed bundle.
export interface StaticLettersData {
  exportedAt: string;
  templates: StaticTemplate[];
  therapists: TherapistItem[];
  operators: StaticOperator[];
}
