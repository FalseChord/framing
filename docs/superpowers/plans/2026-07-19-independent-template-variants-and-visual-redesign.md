# 範本變體獨立儲存＋全站視覺重設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `[只有]/[除外]` bracket-syntax variant system with one independently-editable `Template` row per (category, variant), remove the now-redundant `letters_log` audit table, and apply a utilitarian/dense full-site visual design (amber accent, persistent nav, zero new dependencies) across all pages.

**Architecture:** Backend-first ordering — flatten the Prisma schema, migrate existing real template content, simplify the render pipeline, then update API routes — followed by frontend infrastructure (global CSS tokens, shared nav via a Next.js route group) and finally the page-level UI rewrites that consume both.

**Tech Stack:** Next.js 15 (App Router) + React 19, Prisma 6 + SQLite, Handlebars, iron-session, Vitest. No new dependencies are introduced by this plan.

## Global Constraints

- Do not add any new npm dependency (frontend or backend) — implement styling with plain CSS / CSS custom properties and native HTML elements (`<details>/<summary>`), per `docs/superpowers/specs/2026-07-19-visual-design-direction.md`.
- All UI copy stays in Traditional Chinese, matching existing pages.
- `src/lib/letters/*.ts` changes follow TDD: update/write the test first, run it to see it fail, then implement.
- Test command: `npx vitest run <path>` for a single file, `npm test` for the whole suite (per `CLAUDE.md`).
- `prisma/dev.db`, `*.db-journal`, and any `.bak` file are gitignored (`*.db`, `*.db-journal` in `.gitignore`) — never `git add` them.
- Never write real case data into the repo or into template content; the existing template bodies are clinic-authored *letter text*, not case data, and are already committed — preserve them exactly through the migration.
- Commit after each task, following the existing log style (`feat:`, `fix:`, `refactor:`, `docs:`).
- Content width for all pages is 960px centered (`.page-container` class defined in Task 8).
- Reference specs: `docs/superpowers/specs/2026-07-19-independent-template-variants-design.md` and `docs/superpowers/specs/2026-07-19-visual-design-direction.md`.

---

### Task 1: Flatten the Prisma schema and back up existing data

**Files:**
- Modify: `prisma/schema.prisma`
- Create (untracked, safety only): `prisma/dev.db.bak`

**Interfaces:**
- Produces: `Template` model with `variantLabel: String @default("不適用")` replacing `variants`, `@@unique([category, variantLabel])`; `LetterLog` model removed entirely; `User.letters` and `Template.letters` relation fields removed.

- [ ] **Step 1: Back up the current database**

```bash
cp prisma/dev.db prisma/dev.db.bak
```

Expected: `prisma/dev.db.bak` now exists alongside `prisma/dev.db`. This file is covered by the existing `*.db` gitignore rule — confirm with `git status --short prisma/` that it shows as untracked/ignored, not staged.

- [ ] **Step 2: Edit the schema**

Replace the full contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String     @id @default(uuid())
  name      String
  signature String
  createdAt DateTime   @default(now())
  templates Template[]

  @@map("users")
}

model Therapist {
  id       String  @id @default(uuid())
  name     String
  isActive Boolean @default(true)
  email    String?
  note     String?

  @@map("therapists")
}

model Template {
  id             String   @id @default(uuid())
  category       String
  variantLabel   String   @default("不適用")
  subject        String
  body           String
  requiredFields String   @default("[]")
  updatedAt      DateTime @updatedAt
  updatedById    String
  updatedBy      User     @relation(fields: [updatedById], references: [id])

  @@unique([category, variantLabel])
  @@map("templates")
}
```

(This removes the `LetterLog` model and the `User.letters` / `Template.letters` relation fields that pointed to it, and replaces `Template.variants` with `Template.variantLabel` plus the new unique constraint.)

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name flatten_template_variants
```

Expected: Prisma prints `Applying migration ...` and finishes with `Your database is now in sync with your schema.` If it warns about dropping the `variants` column or the `letters_log` table, confirm/proceed — both are intentional (content is preserved on the `Template` rows that remain; `letters_log` is being removed per the design spec).

- [ ] **Step 4: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client ...` with no errors. (This step also runs automatically as part of `migrate dev`, but running it explicitly here confirms the generated types compile before later tasks depend on them.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "refactor: flatten Template schema to one row per variant, drop letters_log"
```

---

### Task 2: Migrate existing 媒合信/準備信 content into independent variant rows

**Files:**
- Create (temporary, deleted in Task 5): `prisma/migrate-split-variants.ts`
- Modify: `prisma/import-real-templates.ts`

**Interfaces:**
- Consumes: `resolveVariantBlocks` from `src/lib/letters/variantBlocks.ts` (still present — deleted in Task 5), `renderLetter` from `src/lib/letters/render.ts` (still accepts a `variant` param at this point — simplified in Task 3).
- Produces: 12 new `Template` rows (6 for 媒合信, 6 for 準備信) in `prisma/dev.db`, each with its own `requiredFields`; the 2 old merged rows deleted; `prisma/import-real-templates.ts` updated so a fresh install produces the same already-split rows going forward.

- [ ] **Step 1: Write the migration script**

Create `prisma/migrate-split-variants.ts`:

```ts
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
```

- [ ] **Step 2: Run it**

```bash
npx tsx prisma/migrate-split-variants.ts
```

Expected: 12 lines like `已建立「媒合信 - 一般」，必填欄位：caseRef、therapistName、sessionSlots、fee`, then 2 lines like `已刪除舊版合併模板「媒合信」（id: real-template-matching）`, then `遷移完成，所有變體渲染結果與拆分前一致。` If it throws a `驗證失敗` error instead, stop — do not proceed to Step 3 — and re-check `resolveVariantBlocks`/`extractReferencedFields` before re-running (the script is safe to re-run after fixing: it will fail cleanly on `findFirst` returning null for a category that's already been split, telling you which category still needs the old merged row restored from `prisma/dev.db.bak`).

- [ ] **Step 3: Fold the generated content into `prisma/import-real-templates.ts`**

Open `prisma/generated-variant-upserts.txt` and copy its full contents.

Open `prisma/import-real-templates.ts`. Find the block starting at:
```ts
  await prisma.template.upsert({
    where: { id: "real-template-matching" },
```
and ending at the closing `});` of the block whose `where` is `{ id: "real-template-preparation" }` (currently lines 87–227, immediately before the final `console.log(...)` line). Delete that entire span — both the 媒合信 and 準備信 upsert blocks — and paste in the copied content from `prisma/generated-variant-upserts.txt` in its place, keeping one blank line before the following `console.log` line.

Update the final line of `main()` to:

```ts
  console.log("Real template content imported (媒合信 x6, 準備信 x6, 線上諮詢預約確認信, 通訊諮商預約確認信).");
```

- [ ] **Step 4: Verify the rewritten import script is idempotent**

```bash
npx tsx prisma/import-real-templates.ts
```

Expected: no errors, ends with the updated `console.log` message. Since every id in the file already exists in `dev.db` from Step 2, every `upsert` takes the `update: {}` no-op path — this run proves the file is syntactically valid and its ids match what's already in the database.

- [ ] **Step 5: Clean up the generated snippet file**

```bash
rm prisma/generated-variant-upserts.txt
```

(`prisma/migrate-split-variants.ts` itself stays for now — it's deleted together with `variantBlocks.ts` in Task 5, after the content has been reviewed.)

- [ ] **Step 6: Commit**

```bash
git add prisma/migrate-split-variants.ts prisma/import-real-templates.ts
git commit -m "feat: split 媒合信/準備信 into independent variant rows"
```

---

### Task 3: Simplify `render.ts` to drop the `variant` parameter

**Files:**
- Modify: `src/lib/letters/render.ts`
- Test: `src/lib/letters/render.test.ts`

**Interfaces:**
- Produces: `renderLetter(input: { templateBody, requiredFields, fields, slotCount? }): string` — `variant` removed from `RenderInput` and from the function body.

- [ ] **Step 1: Update the test file first**

Replace the full contents of `src/lib/letters/render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderLetter, MissingFieldsError } from "./render";

describe("renderLetter", () => {
  it("substitutes declared fields into the template body", () => {
    const result = renderLetter({
      templateBody: "親愛的 {{caseRef}}：心理師為 {{therapistName}}。",
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。");
  });

  it("throws MissingFieldsError listing every empty required field", () => {
    expect(() =>
      renderLetter({
        templateBody: "{{caseRef}} {{therapistName}}",
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "", therapistName: "" },
      })
    ).toThrowError(MissingFieldsError);
  });

  it("lists exactly the missing field names on the thrown error", () => {
    try {
      renderLetter({
        templateBody: "{{caseRef}} {{therapistName}}",
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "A001", therapistName: "" },
      });
      throw new Error("expected renderLetter to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFieldsError);
      expect((err as MissingFieldsError).missingFields).toEqual(["therapistName"]);
    }
  });

  it("resolves slot blocks using slotCount", () => {
    const result = renderLetter({
      templateBody: "[單一時段]時間為 {{sessionSlots}}[/單一時段][多個時段]候選時間：{{sessionSlots}}[/多個時段]",
      requiredFields: ["sessionSlots"],
      fields: { sessionSlots: "7/22 (三) 19:00-20:20" },
      slotCount: 1,
    });
    expect(result).toBe("時間為 7/22 (三) 19:00-20:20");
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npx vitest run src/lib/letters/render.test.ts
```

Expected: FAIL — `renderLetter` still requires a `variant` property (TypeScript compile error surfaced by Vitest, or a runtime mismatch), since `render.ts` hasn't changed yet.

- [ ] **Step 3: Update `render.ts`**

Replace the full contents of `src/lib/letters/render.ts`:

```ts
import Handlebars from "handlebars";
import { resolveSlotBlocks } from "./slotBlocks";

export interface RenderInput {
  templateBody: string;
  requiredFields: string[];
  fields: Record<string, string>;
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

  const text = resolveSlotBlocks(input.templateBody, input.slotCount ?? -1);

  const compiled = Handlebars.compile(text, { noEscape: true });
  return compiled(input.fields);
}
```

- [ ] **Step 4: Run the test to see it pass**

```bash
npx vitest run src/lib/letters/render.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/render.ts src/lib/letters/render.test.ts
git commit -m "refactor: drop variant parameter from renderLetter"
```

---

### Task 4: Remove `"variant"` from `templateFields.ts`'s standard fields

**Files:**
- Modify: `src/lib/letters/templateFields.ts`
- Test: `src/lib/letters/templateFields.test.ts`

**Interfaces:**
- Produces: `findUndeclaredFields(body, requiredFields)` now flags `{{variant}}` as undeclared (previously treated as an always-available standard field).

- [ ] **Step 1: Add the failing test**

Add this test case to the `describe("findUndeclaredFields", ...)` block in `src/lib/letters/templateFields.test.ts` (append after the existing last test):

```ts
  it("now flags {{variant}} as undeclared, since the variant mechanism no longer exists", () => {
    expect(findUndeclaredFields("{{variant}}", [])).toEqual(["variant"]);
  });
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npx vitest run src/lib/letters/templateFields.test.ts
```

Expected: FAIL — `findUndeclaredFields("{{variant}}", [])` currently returns `[]` because `"variant"` is still in `STANDARD_FIELDS`.

- [ ] **Step 3: Update `templateFields.ts`**

In `src/lib/letters/templateFields.ts`, change line 1:

```ts
const STANDARD_FIELDS = ["caseRef", "therapistName", "sessionDate", "variant"];
```

to:

```ts
const STANDARD_FIELDS = ["caseRef", "therapistName", "sessionDate"];
```

- [ ] **Step 4: Run the test to see it pass**

```bash
npx vitest run src/lib/letters/templateFields.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/templateFields.ts src/lib/letters/templateFields.test.ts
git commit -m "refactor: stop treating {{variant}} as an implicit standard field"
```

---

### Task 5: Delete `variantBlocks.ts` and the temporary migration script

**Files:**
- Delete: `src/lib/letters/variantBlocks.ts`
- Delete: `src/lib/letters/variantBlocks.test.ts`
- Delete: `prisma/migrate-split-variants.ts`

**Interfaces:**
- Consumes: nothing outside this task should still import `resolveVariantBlocks` — verified in Step 1.

- [ ] **Step 1: Confirm nothing else references it**

```bash
grep -rn "variantBlocks\|resolveVariantBlocks" src/ prisma/ --include="*.ts" --include="*.tsx"
```

Expected: no output (Task 2's script and Task 3's `render.ts` were the only consumers, and Task 2's script is being deleted in this same task).

- [ ] **Step 2: Delete the files**

```bash
rm src/lib/letters/variantBlocks.ts src/lib/letters/variantBlocks.test.ts prisma/migrate-split-variants.ts
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all remaining tests pass, no failures referencing the deleted files.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/letters/variantBlocks.ts src/lib/letters/variantBlocks.test.ts prisma/migrate-split-variants.ts
git commit -m "chore: remove variantBlocks.ts and the one-time variant-split migration script"
```

---

### Task 6: Update the Templates API routes for `variantLabel`

**Files:**
- Modify: `src/app/api/templates/route.ts`
- Modify: `src/app/api/templates/[id]/route.ts`

**Interfaces:**
- Consumes: `Prisma.PrismaClientKnownRequestError` from `@prisma/client` (for catching the `(category, variantLabel)` unique constraint violation, error code `P2002`).
- Produces: `GET /api/templates` returns `{ id, category, variantLabel, subject, body, requiredFields }[]`; `POST`/`PUT` accept `{ category, variantLabel, subject, body, requiredFields }` and return `400` with `{ error: "這個類別已經有同名的變體了，請換個名稱或改用編輯" }` on a duplicate.

- [ ] **Step 1: Rewrite `src/app/api/templates/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return {
    ...template,
    requiredFields: decodeRequiredFields(template.requiredFields),
  };
}

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: [{ category: "asc" }, { variantLabel: "asc" }],
  });
  return NextResponse.json(templates.map(serializeTemplate));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { category, variantLabel, subject, body, requiredFields } = await request.json();
  if (!category || !subject || !body) {
    return NextResponse.json({ error: "類別、標題、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const declaredVariantLabel: string = variantLabel?.trim() ? variantLabel.trim() : "不適用";

  let template: Template;
  try {
    template = await prisma.template.create({
      data: {
        category,
        variantLabel: declaredVariantLabel,
        subject,
        body,
        requiredFields: encodeRequiredFields(declaredFields),
        updatedById: session.userId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "這個類別已經有同名的變體了，請換個名稱或改用編輯" },
        { status: 400 }
      );
    }
    throw err;
  }

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields }, { status: 201 });
}
```

- [ ] **Step 2: Rewrite `src/app/api/templates/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return {
    ...template,
    requiredFields: decodeRequiredFields(template.requiredFields),
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { category, variantLabel, subject, body, requiredFields } = await request.json();
  if (!category || !subject || !body) {
    return NextResponse.json({ error: "類別、標題、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const declaredVariantLabel: string = variantLabel?.trim() ? variantLabel.trim() : "不適用";

  let template: Template;
  try {
    template = await prisma.template.update({
      where: { id },
      data: {
        category,
        variantLabel: declaredVariantLabel,
        subject,
        body,
        requiredFields: encodeRequiredFields(declaredFields),
        updatedById: session.userId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "這個類別已經有同名的變體了，請換個名稱或改用編輯" },
        { status: 400 }
      );
    }
    throw err;
  }

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields });
}
```

- [ ] **Step 3: Manually verify against the dev server**

```bash
npm run dev
```

In another terminal, confirm the endpoint responds with the new shape:

```bash
curl -s http://localhost:3000/api/templates | head -c 300
```

Expected: JSON array where each item has a `variantLabel` key (not `variants`). Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/templates/route.ts src/app/api/templates/[id]/route.ts
git commit -m "feat: update templates API for variantLabel and unique-constraint errors"
```

---

### Task 7: Update the letter-generation API route

**Files:**
- Modify: `src/app/api/letters/generate/route.ts`

**Interfaces:**
- Consumes: `renderLetter` from Task 3 (no `variant` param).
- Produces: `POST /api/letters/generate` accepts `{ templateId, fields, slotCount?, includeLine? }` (no `variant`); no longer writes to `letterLog`.

- [ ] **Step 1: Rewrite the route**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/letters/generate/route.ts
git commit -m "feat: drop variant param and audit log write from letter generation route"
```

---

### Task 8: Global design tokens and base styles

**Files:**
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties (`--color-*`, `--space-*`, `--font-*`) and reusable classes (`.page-container`, `.button`, `.button-primary`, `.button-secondary`, `.button-danger`, `.list`) available on every page, since `layout.tsx` wraps the whole app.

- [ ] **Step 1: Create `src/app/globals.css`**

```css
:root {
  --color-bg: #fafaf9;
  --color-surface: #ffffff;
  --color-border: #e5e2dc;
  --color-text: #1f1d1a;
  --color-text-muted: #6b6459;
  --color-accent-bg: #fde68a;
  --color-accent-strong: #b45309;
  --color-accent-strong-hover: #92400e;
  --color-danger: #b91c1c;
  --color-danger-bg: #fee2e2;

  --space-1: 8px;
  --space-2: 12px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  line-height: 1.6;
}

h1, h2, h3 {
  line-height: 1.3;
}

.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-3);
}

label {
  display: block;
  margin-bottom: var(--space-3);
  font-weight: 600;
}

label input,
label select,
label textarea {
  display: block;
  width: 100%;
  margin-top: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: normal;
  background: var(--color-surface);
  color: var(--color-text);
}

label input:focus,
label select:focus,
label textarea:focus {
  outline: 2px solid var(--color-accent-bg);
  outline-offset: 1px;
  border-color: var(--color-accent-strong);
}

.button {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  margin: 0 var(--space-2) var(--space-2) 0;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.button-primary {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
  color: #ffffff;
}

.button-primary:hover {
  background: var(--color-accent-strong-hover);
  border-color: var(--color-accent-strong-hover);
}

.button-secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.button-secondary:hover {
  border-color: var(--color-accent-strong);
}

.button-danger {
  background: var(--color-surface);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.button-danger:hover {
  background: var(--color-danger-bg);
}

ul.list {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4) 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

ul.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: background-color 150ms ease;
}

ul.list li:last-child {
  border-bottom: none;
}

ul.list li:hover {
  background: var(--color-accent-bg);
}

details {
  margin-top: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
}

details summary {
  cursor: pointer;
  font-weight: 600;
}

details ul.list {
  margin-top: var(--space-2);
}
```

- [ ] **Step 2: Import it in the root layout**

Replace the full contents of `src/app/layout.tsx`:

```tsx
import "./globals.css";

export const metadata = {
  title: "信件模板系統",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify it loads**

```bash
npm run dev
```

Open `http://localhost:3000/select` in a browser — confirm the background is off-white (not pure white) and the page renders without console errors. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add global design tokens and base styles"
```

---

### Task 9: Shared navigation bar and route-group restructure

**Files:**
- Create: `src/components/AppNav.tsx`
- Create: `src/components/AppNav.module.css`
- Create: `src/app/(app)/layout.tsx`
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`
- Move: `src/app/generate/page.tsx` → `src/app/(app)/generate/page.tsx`
- Move: `src/app/templates/page.tsx` → `src/app/(app)/templates/page.tsx`
- Move: `src/app/therapists/page.tsx` → `src/app/(app)/therapists/page.tsx`
- Move: `src/app/users/page.tsx` → `src/app/(app)/users/page.tsx`

**Interfaces:**
- Consumes: `getSession()` from `src/lib/auth/session.ts` (reads `session.name`, `session.signature`).
- Produces: every route under the `(app)` group is wrapped with `<AppNav />` + `.page-container`; `/select` (left outside the group) is unaffected. URLs (`/`, `/generate`, `/templates`, `/therapists`, `/users`) do not change — route groups are file-organization only.

- [ ] **Step 1: Move the page files**

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/generate "src/app/(app)/generate"
git mv src/app/templates "src/app/(app)/templates"
git mv src/app/therapists "src/app/(app)/therapists"
git mv src/app/users "src/app/(app)/users"
```

Expected: `git status` shows these as renames, `src/app/select/page.tsx` and `src/app/api/**` are untouched.

- [ ] **Step 2: Create the nav component's CSS module**

Create `src/components/AppNav.module.css`:

```css
.nav {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.navInner {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-2) var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.brand {
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  white-space: nowrap;
}

.links {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  flex: 1;
}

.link {
  color: var(--color-text-muted);
  text-decoration: none;
  padding: var(--space-1) 0;
}

.link:hover {
  color: var(--color-accent-strong);
}

.identity {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  white-space: nowrap;
}
```

- [ ] **Step 3: Create the nav component**

Create `src/components/AppNav.tsx`:

```tsx
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import styles from "./AppNav.module.css";

const NAV_LINKS = [
  { href: "/generate", label: "產生信件" },
  { href: "/templates", label: "模板管理" },
  { href: "/therapists", label: "心理師管理" },
  { href: "/users", label: "操作者管理" },
];

export default async function AppNav() {
  const session = await getSession();

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand}>
          信件模板系統
        </Link>
        <nav className={styles.links}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
        {session.name && (
          <span className={styles.identity}>
            目前操作者：{session.name}（{session.signature}）
          </span>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create the route-group layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import AppNav from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <div className="page-container">{children}</div>
    </>
  );
}
```

- [ ] **Step 5: Verify routing and nav still work**

```bash
npm run dev
```

Visit `http://localhost:3000/select`, pick an identity, confirm you land on `/` and see the nav bar with your name and signature on the right, and that all 4 nav links navigate correctly. Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppNav.tsx src/components/AppNav.module.css "src/app/(app)"
git commit -m "feat: add persistent nav bar with operator identity, restructure into route group"
```

---

### Task 10: Rewrite the templates management page

**Files:**
- Modify: `src/app/(app)/templates/page.tsx`

**Interfaces:**
- Consumes: `GET /api/templates` (returns `variantLabel` per row, from Task 6), `POST`/`PUT /api/templates`(`[id]`) with `{ category, variantLabel, subject, body, requiredFields }`.

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/(app)/templates/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  category: string;
  variantLabel: string;
  subject: string;
  body: string;
  requiredFields: string[];
}

interface FormState {
  id: string | null;
  category: string;
  categoryLocked: boolean;
  variantLabel: string;
  subject: string;
  body: string;
  requiredFieldsText: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  category: "",
  categoryLocked: false,
  variantLabel: "不適用",
  subject: "",
  body: "",
  requiredFieldsText: "",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [warning, setWarning] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/templates");
    setTemplates(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();

  function startEdit(t: TemplateItem) {
    setForm({
      id: t.id,
      category: t.category,
      categoryLocked: true,
      variantLabel: t.variantLabel,
      subject: t.subject,
      body: t.body,
      requiredFieldsText: t.requiredFields.join(", "),
    });
    setWarning([]);
    setError("");
  }

  function startNewVariant(category: string) {
    setForm({ ...EMPTY_FORM, category, categoryLocked: true });
    setWarning([]);
    setError("");
  }

  function startNewCategory() {
    setForm({ ...EMPTY_FORM });
    setWarning([]);
    setError("");
  }

  function cancelEdit() {
    setForm(null);
    setWarning([]);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");

    const requiredFields = form.requiredFieldsText
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const url = form.id ? `/api/templates/${form.id}` : "/api/templates";
    const method = form.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.category,
        variantLabel: form.variantLabel,
        subject: form.subject,
        body: form.body,
        requiredFields,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setWarning(data.undeclaredFields ?? []);
    setForm(null);
    await load();
  }

  return (
    <main>
      <h1>模板管理</h1>
      <button type="button" className="button button-primary" onClick={startNewCategory}>
        ＋ 新增類別
      </button>

      {categories.map((category) => {
        const variants = templates.filter((t) => t.category === category);
        return (
          <details key={category}>
            <summary>
              {category}（{variants.length} 個變體）
            </summary>
            <ul className="list">
              {variants.map((t) => (
                <li key={t.id}>
                  <span>{t.variantLabel}</span>
                  <button type="button" className="button button-secondary" onClick={() => startEdit(t)}>
                    編輯
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="button button-secondary" onClick={() => startNewVariant(category)}>
              ＋ 新增變體
            </button>
          </details>
        );
      })}

      {form && (
        <form onSubmit={handleSubmit} style={{ marginTop: "24px" }}>
          <h2>{form.id ? "編輯變體" : "新增變體"}</h2>
          <label>
            類別
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              disabled={form.categoryLocked}
              required
            />
          </label>
          <label>
            變體名稱（無方案差異就填「不適用」）
            <input
              value={form.variantLabel}
              onChange={(e) => setForm({ ...form, variantLabel: e.target.value })}
              required
            />
          </label>
          <label>
            標題
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </label>
          <label>
            內文
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              rows={26}
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </label>
          <p>
            語法提示：
            <br />
            多時段差異：<code>[單一時段]...[/單一時段]</code>、<code>[多個時段]...[/多個時段]</code>
            <br />
            粗體＋淺黃底色：<code>**文字**</code>
          </p>
          <label>
            必填欄位（用逗號分隔，例如：caseRef, therapistName, sessionDate）
            <input
              value={form.requiredFieldsText}
              onChange={(e) => setForm({ ...form, requiredFieldsText: e.target.value })}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="button button-primary">
            {form.id ? "儲存修改" : "新增變體"}
          </button>
          <button type="button" className="button button-secondary" onClick={cancelEdit}>
            取消
          </button>
        </form>
      )}
      {warning.length > 0 && (
        <p role="alert">注意：內文引用了未宣告的欄位（{warning.join("、")}），請確認拼字是否正確。</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Manually verify against the dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/templates`. Confirm: categories are grouped and collapsible, expanding "媒合信" shows 6 variant rows, clicking "編輯" on one loads its own `subject`/`body`/`requiredFields` (not the others'), the textarea is large and monospace, and "＋ 新增變體" under a category pre-fills (and locks) that category. Stop the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/templates/page.tsx"
git commit -m "feat: rewrite templates page for per-variant editing with category grouping"
```

---

### Task 11: Rewrite the generate page for category → variant selection

**Files:**
- Modify: `src/app/(app)/generate/page.tsx`

**Interfaces:**
- Consumes: `GET /api/templates` (rows now carry `variantLabel` and per-variant `requiredFields`), `POST /api/letters/generate` with `{ templateId, fields, slotCount?, includeLine? }` (no `variant`, from Task 7).

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/(app)/generate/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { buildGmailComposeUrl } from "@/lib/letters/gmailUrl";
import { formatSessionSlot, formatSessionSlots, type SessionSlotInput } from "@/lib/letters/dateFormat";

interface TemplateItem {
  id: string;
  category: string;
  variantLabel: string;
  subject: string;
  requiredFields: string[];
}

interface Therapist {
  id: string;
  name: string;
}

const EMPTY_SLOT: SessionSlotInput = { date: "", startTime: "", endTime: "" };

export default function GeneratePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [category, setCategory] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [sessionDateValue, setSessionDateValue] = useState<SessionSlotInput>(EMPTY_SLOT);
  const [sessionSlotValues, setSessionSlotValues] = useState<SessionSlotInput[]>([EMPTY_SLOT]);
  const [toEmails, setToEmails] = useState<string[]>([""]);
  const [bccEmails, setBccEmails] = useState<string[]>([""]);
  const [includeLine, setIncludeLine] = useState(false);
  const [result, setResult] = useState<{ subject: string; html: string; plain: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/therapists").then((r) => r.json()).then(setTherapists);
  }, []);

  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();
  const categoryVariants = templates.filter((t) => t.category === category);
  const showVariantPicker = categoryVariants.length > 1;
  const selectedTemplate = templates.find((t) => t.id === templateId);

  function resetFormState() {
    setTextFields({});
    setSessionDateValue(EMPTY_SLOT);
    setSessionSlotValues([EMPTY_SLOT]);
    setResult(null);
    setError("");
  }

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const variants = templates.filter((t) => t.category === nextCategory);
    setTemplateId(variants.length === 1 ? variants[0].id : "");
    resetFormState();
  }

  function handleVariantChange(id: string) {
    setTemplateId(id);
    resetFormState();
  }

  function setTextField(name: string, value: string) {
    setTextFields((prev) => ({ ...prev, [name]: value }));
  }

  function updateSlot(index: number, patch: Partial<SessionSlotInput>) {
    setSessionSlotValues((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function updateEmailList(list: string[], setList: (v: string[]) => void, index: number, value: string) {
    setList(list.map((email, i) => (i === index ? value : email)));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedTemplate) return;

    const fields: Record<string, string> = { ...textFields };
    let slotCount: number | undefined;

    if (selectedTemplate.requiredFields.includes("sessionDate")) {
      fields.sessionDate = sessionDateValue.date ? formatSessionSlot(sessionDateValue) : "";
    }
    if (selectedTemplate.requiredFields.includes("sessionSlots")) {
      const filledSlots = sessionSlotValues.filter((slot) => slot.date);
      const formatted = formatSessionSlots(filledSlots);
      fields.sessionSlots = formatted.text;
      slotCount = formatted.count;
    }

    const res = await fetch("/api/letters/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, fields, slotCount, includeLine }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResult({ subject: data.renderedSubject, html: data.renderedBodyHtml, plain: data.renderedBodyPlain });
  }

  async function handleCopyAndOpenGmail() {
    if (!result) return;
    const htmlBlob = new Blob([result.html], { type: "text/html" });
    const textBlob = new Blob([result.plain], { type: "text/plain" });
    await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })]);

    const url = buildGmailComposeUrl({
      to: toEmails.filter((e) => e.trim()).join(","),
      bcc: bccEmails.filter((e) => e.trim()).join(","),
      subject: result.subject,
    });
    window.open(url, "_blank");
  }

  return (
    <main>
      <h1>產生信件</h1>
      <form onSubmit={handleGenerate}>
        <label>
          信件類別
          <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} required>
            <option value="">請選擇</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {showVariantPicker && (
          <label>
            方案
            <select value={templateId} onChange={(e) => handleVariantChange(e.target.value)} required>
              <option value="">請選擇</option>
              {categoryVariants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.variantLabel}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedTemplate?.requiredFields.map((fieldName) => {
          if (fieldName === "therapistName") {
            return (
              <label key={fieldName}>
                心理師
                <select
                  value={textFields.therapistName ?? ""}
                  onChange={(e) => setTextField("therapistName", e.target.value)}
                  required
                >
                  <option value="">請選擇</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          if (fieldName === "sessionDate") {
            return (
              <fieldset key={fieldName}>
                <legend>日期時段</legend>
                <input
                  type="date"
                  value={sessionDateValue.date}
                  onChange={(e) => setSessionDateValue({ ...sessionDateValue, date: e.target.value })}
                  required
                />
                <input
                  type="time"
                  value={sessionDateValue.startTime}
                  onChange={(e) => setSessionDateValue({ ...sessionDateValue, startTime: e.target.value })}
                  required
                />
                至
                <input
                  type="time"
                  value={sessionDateValue.endTime}
                  onChange={(e) => setSessionDateValue({ ...sessionDateValue, endTime: e.target.value })}
                  required
                />
              </fieldset>
            );
          }
          if (fieldName === "sessionSlots") {
            return (
              <fieldset key={fieldName}>
                <legend>候選時段（可新增多筆）</legend>
                {sessionSlotValues.map((slot, index) => (
                  <div key={index}>
                    <input type="date" value={slot.date} onChange={(e) => updateSlot(index, { date: e.target.value })} required />
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                      required
                    />
                    至
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlot(index, { endTime: e.target.value })}
                      required
                    />
                    {sessionSlotValues.length > 1 && (
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => setSessionSlotValues(sessionSlotValues.filter((_, i) => i !== index))}
                      >
                        刪除
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="button button-secondary" onClick={() => setSessionSlotValues([...sessionSlotValues, EMPTY_SLOT])}>
                  新增時段
                </button>
              </fieldset>
            );
          }
          if (fieldName === "caseRef") {
            return (
              <label key={fieldName}>
                個案代號
                <input value={textFields.caseRef ?? ""} onChange={(e) => setTextField("caseRef", e.target.value)} required />
              </label>
            );
          }
          return (
            <label key={fieldName}>
              {fieldName}
              <input value={textFields[fieldName] ?? ""} onChange={(e) => setTextField(fieldName, e.target.value)} required />
            </label>
          );
        })}

        <fieldset>
          <legend>收件者（選填，可新增多筆）</legend>
          {toEmails.map((email, index) => (
            <div key={index}>
              <input type="email" value={email} onChange={(e) => updateEmailList(toEmails, setToEmails, index, e.target.value)} />
              {toEmails.length > 1 && (
                <button type="button" className="button button-danger" onClick={() => setToEmails(toEmails.filter((_, i) => i !== index))}>
                  刪除
                </button>
              )}
            </div>
          ))}
          <button type="button" className="button button-secondary" onClick={() => setToEmails([...toEmails, ""])}>
            新增收件者
          </button>
        </fieldset>

        <fieldset>
          <legend>密件副本 BCC（選填，可新增多筆）</legend>
          {bccEmails.map((email, index) => (
            <div key={index}>
              <input
                type="email"
                value={email}
                onChange={(e) => updateEmailList(bccEmails, setBccEmails, index, e.target.value)}
              />
              {bccEmails.length > 1 && (
                <button type="button" className="button button-danger" onClick={() => setBccEmails(bccEmails.filter((_, i) => i !== index))}>
                  刪除
                </button>
              )}
            </div>
          ))}
          <button type="button" className="button button-secondary" onClick={() => setBccEmails([...bccEmails, ""])}>
            新增密件副本
          </button>
        </fieldset>

        <label>
          <input type="checkbox" checked={includeLine} onChange={(e) => setIncludeLine(e.target.checked)} style={{ display: "inline-block", width: "auto", marginRight: "8px" }} />
          附加官方 LINE 聯繫方式
        </label>

        {error && <p role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={!templateId}>
          產生信件
        </button>
      </form>
      {result && (
        <section>
          <h2>產出結果</h2>
          <p>主旨：{result.subject}</p>
          <div dangerouslySetInnerHTML={{ __html: result.html }} />
          <h3>純文字版本（供核對）</h3>
          <pre>{result.plain}</pre>
          <button className="button button-primary" onClick={handleCopyAndOpenGmail}>
            複製格式化內文並開啟 Gmail 草稿
          </button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Manually verify against the dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/generate`. Confirm: selecting "媒合信" shows a 方案 dropdown with 6 options; selecting "EAP" shows an `eapPlanName` field that "一般" does not; selecting "線上諮詢預約確認信" (single-variant) skips the 方案 dropdown entirely and shows its fields directly. Generate a letter end-to-end with synthetic test data and confirm it renders. Stop the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/generate/page.tsx"
git commit -m "feat: rewrite generate page for category-then-variant selection"
```

---

### Task 12: Apply shared styles to the remaining pages

**Files:**
- Modify: `src/app/(app)/therapists/page.tsx`
- Modify: `src/app/(app)/users/page.tsx`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/app/select/page.tsx`

**Interfaces:**
- Consumes: `.list`, `.button`, `.button-primary`, `.button-secondary`, `.page-container` classes from Task 8's `globals.css`.

- [ ] **Step 1: Update `src/app/(app)/therapists/page.tsx`**

Replace the `return (...)` block's JSX with:

```tsx
  return (
    <main>
      <h1>心理師名單管理</h1>
      <ul className="list">
        {therapists.map((t) => (
          <li key={t.id}>
            <span>
              {t.name}
              {!t.isActive && "（已停用）"}
              {t.email && ` · ${t.email}`}
              {t.note && ` · ${t.note}`}
            </span>
            <button type="button" className="button button-secondary" onClick={() => startEdit(t)}>
              編輯
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "編輯心理師" : "新增心理師"}</h2>
        <label>
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email（選填）
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          備註（選填）
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {editingId && (
          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ display: "inline-block", width: "auto", marginRight: "8px" }}
            />
            啟用中（取消勾選可停用，不會出現在產信下拉選單）
          </label>
        )}
        <button type="submit" className="button button-primary">
          {editingId ? "儲存修改" : "新增心理師"}
        </button>
        {editingId && (
          <button type="button" className="button button-secondary" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
      </form>
    </main>
  );
```

(Only the JSX changes — all state/handler code above it in the file stays exactly as-is.)

- [ ] **Step 2: Update `src/app/(app)/users/page.tsx`**

Replace the `return (...)` block's JSX with:

```tsx
  return (
    <main>
      <h1>操作者名單管理</h1>
      <ul className="list">
        {users.map((u) => (
          <li key={u.id}>
            <span>
              {u.name}（簽名代號：{u.signature}）
            </span>
            <button type="button" className="button button-secondary" onClick={() => startEdit(u)}>
              編輯
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "編輯操作者" : "新增操作者"}</h2>
        <label>
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          簽名代號
          <input value={signature} onChange={(e) => setSignature(e.target.value)} required />
        </label>
        <button type="submit" className="button button-primary">
          {editingId ? "儲存修改" : "新增操作者"}
        </button>
        {editingId && (
          <button type="button" className="button button-secondary" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
      </form>
    </main>
  );
```

(Only the JSX changes — all state/handler code above it stays as-is.)

- [ ] **Step 3: Simplify `src/app/(app)/page.tsx`**

Replace the full contents:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>信件模板系統</h1>
      <p style={{ color: "var(--color-text-muted)" }}>使用上方導覽列切換到產生信件、模板管理或名單管理。</p>
    </main>
  );
}
```

(The `Link` import and manual link list are removed — `AppNav` from Task 9 now covers this navigation, so keeping a duplicate list here would be redundant.)

- [ ] **Step 4: Update `src/app/select/page.tsx`**

Replace the full contents:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserItem {
  id: string;
  name: string;
}

export default function SelectIdentityPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, []);

  async function handleSelect(userId: string) {
    setError("");
    const res = await fetch("/api/auth/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      setError("選擇失敗，請重新整理後再試");
      return;
    }
    router.push("/");
  }

  return (
    <main className="page-container" style={{ maxWidth: "480px" }}>
      <h1>請選擇目前操作者</h1>
      {error && <p role="alert">{error}</p>}
      <ul className="list">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => handleSelect(u.id)}
              style={{ width: "100%", margin: 0 }}
            >
              {u.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Manually verify all pages**

```bash
npm run dev
```

Visit `/select`, `/`, `/generate`, `/templates`, `/therapists`, `/users` — confirm consistent styling (off-white background, amber buttons, bordered list rows with amber hover) and that `/select` has no nav bar while the others do. Stop the dev server when done.

- [ ] **Step 6: Run the full test suite one more time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/therapists/page.tsx" "src/app/(app)/users/page.tsx" "src/app/(app)/page.tsx" src/app/select/page.tsx
git commit -m "style: apply shared design tokens to therapists, users, home, and select pages"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1–2 cover the data-model section of `2026-07-19-independent-template-variants-design.md`; Task 3–5 cover the render-pipeline simplification; Task 6–7 cover the API section; Task 10–11 cover the UI section (including the "editing textarea too small" complaint raised early in brainstorming). Task 8–9, 12 cover every section of `2026-07-19-visual-design-direction.md` (tokens, nav, component approach, page-by-page application).
- **Placeholder scan:** no `TBD`/`TODO`; the one place content isn't pre-written verbatim (Task 2 Step 3's splice) is a fully-specified, deterministic, anchor-based find-and-replace, not an open-ended instruction.
- **Type consistency:** `TemplateItem`/`FormState` shapes in Task 10 and Task 11 both use `variantLabel: string` and `requiredFields: string[]`, matching the API response shape defined in Task 6; `RenderInput` in Task 3 (no `variant`) matches every call site updated in Task 7.
