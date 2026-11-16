import type { TemplateItem, TherapistItem } from "@/components/GenerateLetterForm";

// TemplateItem plus the body — structurally a LetterTemplateContent for
// generateLetter(). Served by the Worker's /api/templates (D1), not baked in.
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
// therapist/operator data only ever leaves this machine as the deployed bundle.
// Templates are NOT in here: they live in D1 and are edited online.
export interface StaticLettersData {
  exportedAt: string;
  therapists: TherapistItem[];
  operators: StaticOperator[];
}
