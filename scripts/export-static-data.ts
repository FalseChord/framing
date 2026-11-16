import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { decodeRequiredFields } from "../src/lib/letters/requiredFields";
import type { StaticLettersData } from "../static/src/data";

// Snapshots the letter-related tables from the local SQLite database (DATABASE_URL
// in .env) into the static build's data file. Run via `npm run build:static`.
const OUTPUT_PATH = resolve(process.cwd(), "static/src/letters-data.json");

const prisma = new PrismaClient();

async function main() {
  const [templates, therapists, users] = await Promise.all([
    prisma.template.findMany({ orderBy: [{ category: "asc" }, { variantLabel: "asc" }] }),
    prisma.therapist.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const data: StaticLettersData = {
    exportedAt: new Date().toISOString(),
    templates: templates.map((t) => ({
      id: t.id,
      category: t.category,
      variantLabel: t.variantLabel,
      subject: t.subject,
      body: t.body,
      requiredFields: decodeRequiredFields(t.requiredFields),
      optionalFields: decodeRequiredFields(t.optionalFields),
    })),
    therapists: therapists.map((t) => ({ id: t.id, name: t.name, email: t.email })),
    operators: users.map((u) => ({ id: u.id, name: u.name, signature: u.signature })),
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(
    `已匯出 ${data.templates.length} 個模板、${data.therapists.length} 位心理師、${data.operators.length} 位操作者 → ${OUTPUT_PATH}`
  );
}

main().finally(() => prisma.$disconnect());
