import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// One-time move of the templates in the local SQLite database (dev.db) into the
// online D1 database, which is the templates' source of truth from then on.
// ON CONFLICT DO NOTHING: re-running never overwrites a template already edited
// online. Run via `npm run seed:d1-templates`.
const OUTPUT_PATH = resolve(process.cwd(), "static/.seed-templates.sql");

const prisma = new PrismaClient();

function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const templates = await prisma.template.findMany({
    include: { updatedBy: true },
    orderBy: [{ category: "asc" }, { variantLabel: "asc" }],
  });
  const statements = templates.map(
    (t) =>
      `INSERT INTO templates (id, category, variant_label, subject, body, required_fields, optional_fields, updated_at, updated_by) VALUES (${[
        t.id,
        t.category,
        t.variantLabel,
        t.subject,
        t.body,
        t.requiredFields,
        t.optionalFields,
        t.updatedAt.toISOString(),
        t.updatedBy.name,
      ]
        .map(sql)
        .join(", ")}) ON CONFLICT(id) DO NOTHING;`
  );
  writeFileSync(OUTPUT_PATH, `${statements.join("\n")}\n`);
  console.log(`已產生 ${templates.length} 個模板的匯入檔 → ${OUTPUT_PATH}`);
}

main().finally(() => prisma.$disconnect());
