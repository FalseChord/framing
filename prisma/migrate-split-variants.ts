import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { resolveVariantBlocks } from "../src/lib/letters/variantBlocks";
import { renderLetter } from "../src/lib/letters/render";

const prisma = new PrismaClient();

const VARIANT_NAMES = ["一般", "伴侶", "青壯", "重大災害", "EAP", "公益"];
const CATEGORIES_TO_SPLIT = ["媒合信", "準備信"];

function extractReferencedFields(text: string, candidates: string[]): string[] {
  const matches = text.matchAll(/{{\s*#?\/?\s*([a-zA-Z_][a-zA-Z0-9_]*)/g);
  const referenced = new Set<string>();
  for (const match of matches) {
    referenced.add(match[1]);
  }
  return candidates.filter((field) => referenced.has(field));
}

function slugify(variantName: string): string {
  const map: Record<string, string> = {
    一般: "general",
    伴侶: "couple",
    青壯: "youth",
    重大災害: "disaster",
    EAP: "eap",
    公益: "charity",
  };
  return map[variantName] ?? variantName;
}

function categorySlug(category: string): string {
  const map: Record<string, string> = {
    媒合信: "matching",
    準備信: "preparation",
  };
  return map[category] ?? category;
}

interface SplitRow {
  id: string;
  category: string;
  variantLabel: string;
  subject: string;
  body: string;
  requiredFields: string[];
}

async function main() {
  const generatedRows: SplitRow[] = [];

  for (const category of CATEGORIES_TO_SPLIT) {
    const original = await prisma.template.findFirst({ where: { category } });
    if (!original) {
      throw new Error(`找不到類別「${category}」的既有模板，請確認 prisma/import-real-templates.ts 已執行過`);
    }

    const originalRequiredFields: string[] = JSON.parse(original.requiredFields);
    const sampleFields = originalRequiredFields.reduce<Record<string, string>>((acc, field) => {
      acc[field] = `測試${field}`;
      return acc;
    }, {});

    for (const variantName of VARIANT_NAMES) {
      const newSubject = resolveVariantBlocks(original.subject, variantName);
      const newBody = resolveVariantBlocks(original.body, variantName);
      const newRequiredFields = extractReferencedFields(`${newSubject}\n${newBody}`, originalRequiredFields);

      const relevantFields = newRequiredFields.reduce<Record<string, string>>((acc, field) => {
        acc[field] = sampleFields[field];
        return acc;
      }, {});

      const oldRendered = renderLetter({
        templateBody: original.body,
        requiredFields: originalRequiredFields,
        fields: sampleFields,
        variant: variantName,
        slotCount: 1,
      });
      const newRendered = renderLetter({
        templateBody: newBody,
        requiredFields: newRequiredFields,
        fields: relevantFields,
        variant: variantName,
        slotCount: 1,
      });

      if (oldRendered !== newRendered) {
        throw new Error(
          `驗證失敗：類別「${category}」變體「${variantName}」拆分前後渲染結果不一致\n舊版：${oldRendered}\n新版：${newRendered}`
        );
      }

      const id = `real-template-${categorySlug(category)}-${slugify(variantName)}`;
      generatedRows.push({
        id,
        category,
        variantLabel: variantName,
        subject: newSubject,
        body: newBody,
        requiredFields: newRequiredFields,
      });

      await prisma.template.create({
        data: {
          id,
          category,
          variantLabel: variantName,
          subject: newSubject,
          body: newBody,
          requiredFields: JSON.stringify(newRequiredFields),
          updatedById: original.updatedById,
        },
      });

      console.log(`已建立「${category} - ${variantName}」，必填欄位：${newRequiredFields.join("、") || "（無）"}`);
    }

    await prisma.template.delete({ where: { id: original.id } });
    console.log(`已刪除舊版合併模板「${category}」（id: ${original.id}）`);
  }

  const generatedSource = generatedRows
    .map(
      (row) => `  await prisma.template.upsert({
    where: { id: "${row.id}" },
    update: {},
    create: {
      id: "${row.id}",
      category: ${JSON.stringify(row.category)},
      variantLabel: ${JSON.stringify(row.variantLabel)},
      subject: ${JSON.stringify(row.subject)},
      body: ${JSON.stringify(row.body)},
      requiredFields: JSON.stringify(${JSON.stringify(row.requiredFields)}),
      updatedById: admin.id,
    },
  });`
    )
    .join("\n\n");

  await fs.writeFile(path.join(__dirname, "generated-variant-upserts.txt"), generatedSource, "utf-8");

  console.log("遷移完成，所有變體渲染結果與拆分前一致。");
  console.log("已產生 prisma/generated-variant-upserts.txt，下一步請依計畫把內容貼進 prisma/import-real-templates.ts。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
