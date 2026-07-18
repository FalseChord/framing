# 信件模板系統 — 資料補完與功能擴充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the `Template` model to a shared-body-per-category architecture with variant/slot conditional blocks and a subject field, add therapist contact fields, add date/multi-slot auto-formatting, add bold+highlight markup rendering with a clipboard-copy Gmail flow, and seed the two simplest real letter categories end-to-end — per `docs/superpowers/specs/2026-07-19-letter-templates-content-completion-design.md`.

**Architecture:** Same single Next.js project as phase 1. New pure-function modules under `src/lib/letters/` handle variant-block resolution, slot-count-block resolution, `**text**` → HTML highlight conversion, date/weekday formatting, and the signature block — composed together in a rewritten `renderLetter`. Prisma schema changes require a local dev-database reset (existing rows are test data only, not production data).

**Tech Stack:** Same as phase 1 — Next.js 15, React 19, TypeScript 5, Prisma 6, SQLite, Handlebars, Vitest.

## Global Constraints

- Never write real case data anywhere in this repo or in prompts to any AI model — all seed/test data must be synthetic. The real letter *boilerplate* content seeded in Task 14 is legitimate business content (no case-identifying information), not case data — this constraint is about client/case PII, not template wording.
- Scale is small by design (≤5 staff) — do not add infrastructure sized for a larger deployment.
- No password/credential verification — operator identification stays name-selection only, unchanged from phase 1.
- Recipient ("to") and BCC emails are entered per-use and must never be persisted to the database or the audit log. Both are optional and independent — BCC-only (no "to") must be a valid submission.
- Date output never includes the year (e.g. `7/22 (三) 19:00-20:20`), per explicit decision — do not add a year even though some pasted source examples included one.
- Content authoring is not required to match pasted source examples 100% — meaning-preserving simplification to reduce variant-to-variant wording differences is expected and encouraged, to keep `[只有]`/`[除外]` blocks simple.
- `**text**` always means "bold + light-yellow background" as a single combined style — there is no syntax for bold-only or highlight-only.

---

### Task 1: Prisma Schema Migration & Synthetic Seed Update

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: `Template` model with `subject: String`, `variants: String` (JSON-encoded `string[]`, replaces the old single `variant: String` column), `body`/`requiredFields`/`updatedAt`/`updatedById` unchanged. `Therapist` model gains `email: String?`, `note: String?`. Every later task's Prisma queries and the existing `encodeRequiredFields`/`decodeRequiredFields` codec (from phase 1's `src/lib/letters/requiredFields.ts`, unchanged) rely on this shape — `variants` reuses the same JSON-string-array codec as `requiredFields`, no new codec needed.

- [ ] **Step 1: Update `prisma/schema.prisma`**

Replace the `Template` and `Therapist` models with:

```prisma
model Therapist {
  id       String  @id @default(uuid())
  name     String
  isActive Boolean @default(true)
  email    String?
  note     String?

  @@map("therapists")
}

model Template {
  id             String      @id @default(uuid())
  category       String
  subject        String
  body           String
  variants       String      @default("[\"不適用\"]")
  requiredFields String      @default("[]")
  updatedAt      DateTime    @updatedAt
  updatedById    String
  updatedBy      User        @relation(fields: [updatedById], references: [id])
  letters        LetterLog[]

  @@map("templates")
}
```

(Leave `User` and `LetterLog` untouched.)

- [ ] **Step 2: Reset the local dev database and apply the new schema**

The existing `prisma/dev.db` only holds synthetic seed/test data (per Global Constraints — no real case data has ever been written to it), and the old `variant`/missing-`subject` shape is structurally incompatible with the new columns, so a reset is the simplest path.

Run: `npx prisma migrate reset --force`
Expected: drops the dev database, replays migrations from scratch, prompts to create a new migration — when prompted, name it `phase2_template_restructure`. Output ends with "Your database is now in sync with your schema".

- [ ] **Step 3: Update `prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: "seed-user-admin" },
    update: {},
    create: {
      id: "seed-user-admin",
      name: "測試人員",
      signature: "TA",
    },
  });

  await prisma.therapist.upsert({
    where: { id: "seed-therapist-a" },
    update: {},
    create: {
      id: "seed-therapist-a",
      name: "測試心理師A",
      email: "therapist-a@example.com",
      note: "測試備註",
    },
  });
  await prisma.therapist.upsert({
    where: { id: "seed-therapist-b" },
    update: {},
    create: { id: "seed-therapist-b", name: "測試心理師B" },
  });

  await prisma.template.upsert({
    where: { id: "seed-template-matching" },
    update: {},
    create: {
      id: "seed-template-matching",
      category: "媒合信（測試）",
      subject: "【測試】諮商媒合信",
      body:
        "親愛的 {{caseRef}} 您好：\n\n" +
        "已為您媒合心理師 **{{therapistName}}**，首次晤談時間為 **{{sessionDate}}**。\n\n" +
        "[只有 EAP]\n本次服務由貴公司 EAP 方案支付費用。\n[/只有]\n" +
        "[除外 EAP]\n期待與您見面。\n[/除外]",
      variants: JSON.stringify(["一般", "EAP"]),
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate"]),
      updatedById: user.id,
    },
  });

  console.log("Seed complete (synthetic data only).");
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

- [ ] **Step 4: Run the seed, twice, to confirm idempotency**

Run: `npx prisma db seed` — expected: "Seed complete (synthetic data only)."
Run again immediately — expected: same message, no duplicate rows.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/migrations
git commit -m "feat: restructure Template schema (subject, variants array) and add therapist email/note"
```

---

### Task 2: Date & Multi-Slot Formatting (TDD)

**Files:**
- Create: `src/lib/letters/dateFormat.ts`
- Create: `src/lib/letters/dateFormat.test.ts`

**Interfaces:**
- Produces: `SessionSlotInput` (`{ date: string; startTime: string; endTime: string }`), `formatSessionSlot(input: SessionSlotInput): string`, `formatSessionSlots(inputs: SessionSlotInput[]): { text: string; count: number }` — Task 13's generate page imports all three to build the `sessionDate`/`sessionSlots` field values and the `slotCount` sent to the generate API.

- [ ] **Step 1: Write the failing test `src/lib/letters/dateFormat.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatSessionSlot, formatSessionSlots } from "./dateFormat";

describe("formatSessionSlot", () => {
  it("formats date+time range with computed weekday, no year", () => {
    // 2026-07-22 is a Wednesday
    const result = formatSessionSlot({ date: "2026-07-22", startTime: "19:00", endTime: "20:20" });
    expect(result).toBe("7/22 (三) 19:00-20:20");
  });

  it("computes a different weekday correctly", () => {
    // 2026-02-12 is a Thursday
    const result = formatSessionSlot({ date: "2026-02-12", startTime: "19:30", endTime: "20:20" });
    expect(result).toBe("2/12 (四) 19:30-20:20");
  });
});

describe("formatSessionSlots", () => {
  it("returns a single inline string and count 1 for one slot", () => {
    const result = formatSessionSlots([{ date: "2026-07-22", startTime: "19:00", endTime: "20:20" }]);
    expect(result).toEqual({ text: "7/22 (三) 19:00-20:20", count: 1 });
  });

  it("returns a bulleted list and count for two or more slots", () => {
    // 2026-02-12 Thursday, 2026-02-24 Tuesday
    const result = formatSessionSlots([
      { date: "2026-02-12", startTime: "19:30", endTime: "20:20" },
      { date: "2026-02-24", startTime: "19:30", endTime: "20:20" },
    ]);
    expect(result.count).toBe(2);
    expect(result.text).toBe("◉ 2/12 (四) 19:30-20:20\n◉ 2/24 (二) 19:30-20:20");
  });

  it("returns empty text and count 0 for no slots", () => {
    expect(formatSessionSlots([])).toEqual({ text: "", count: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/dateFormat.test.ts`
Expected: FAIL with "Cannot find module './dateFormat'".

- [ ] **Step 3: Write `src/lib/letters/dateFormat.ts`**

```ts
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export interface SessionSlotInput {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export function formatSessionSlot(input: SessionSlotInput): string {
  const [, month, day] = input.date.split("-").map(Number);
  const weekday = WEEKDAY_LABELS[new Date(`${input.date}T00:00:00`).getDay()];
  return `${month}/${day} (${weekday}) ${input.startTime}-${input.endTime}`;
}

export function formatSessionSlots(inputs: SessionSlotInput[]): { text: string; count: number } {
  const count = inputs.length;
  if (count === 0) {
    return { text: "", count: 0 };
  }
  if (count === 1) {
    return { text: formatSessionSlot(inputs[0]), count: 1 };
  }
  return { text: inputs.map((slot) => `◉ ${formatSessionSlot(slot)}`).join("\n"), count };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/dateFormat.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/dateFormat.ts src/lib/letters/dateFormat.test.ts
git commit -m "feat: add session date/slot formatting with auto weekday computation"
```

---

### Task 3: Variant Conditional Block Parser (TDD)

**Files:**
- Create: `src/lib/letters/variantBlocks.ts`
- Create: `src/lib/letters/variantBlocks.test.ts`

**Interfaces:**
- Produces: `resolveVariantBlocks(text: string, variant: string): string` — Task 7's rewritten `render.ts` calls this before Handlebars compilation.

- [ ] **Step 1: Write the failing test `src/lib/letters/variantBlocks.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveVariantBlocks } from "./variantBlocks";

describe("resolveVariantBlocks", () => {
  it("keeps the [只有] block content when the variant matches", () => {
    const text = "共用開頭\n[只有 EAP]\nEAP限定文字\n[/只有]\n共用結尾";
    expect(resolveVariantBlocks(text, "EAP")).toBe("共用開頭\n\nEAP限定文字\n\n共用結尾");
  });

  it("removes the [只有] block content when the variant does not match", () => {
    const text = "共用開頭\n[只有 EAP]\nEAP限定文字\n[/只有]\n共用結尾";
    expect(resolveVariantBlocks(text, "一般")).toBe("共用開頭\n\n共用結尾");
  });

  it("supports multiple variant names separated by 、", () => {
    const text = "[只有 青壯、北捷]差異文字[/只有]";
    expect(resolveVariantBlocks(text, "青壯")).toBe("差異文字");
    expect(resolveVariantBlocks(text, "公益")).toBe("");
  });

  it("keeps [除外] block content when the variant is not in the excluded list", () => {
    const text = "[除外 EAP]非EAP文字[/除外]";
    expect(resolveVariantBlocks(text, "一般")).toBe("非EAP文字");
    expect(resolveVariantBlocks(text, "EAP")).toBe("");
  });

  it("leaves text outside any block untouched", () => {
    expect(resolveVariantBlocks("純共用文字，沒有任何區塊", "一般")).toBe("純共用文字，沒有任何區塊");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/variantBlocks.test.ts`
Expected: FAIL with "Cannot find module './variantBlocks'".

- [ ] **Step 3: Write `src/lib/letters/variantBlocks.ts`**

```ts
const ONLY_BLOCK = /\[只有\s*([^\]]+)\]([\s\S]*?)\[\/只有\]/g;
const EXCEPT_BLOCK = /\[除外\s*([^\]]+)\]([\s\S]*?)\[\/除外\]/g;

function parseVariantList(raw: string): string[] {
  return raw
    .split(/[、,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function resolveVariantBlocks(text: string, variant: string): string {
  let result = text.replace(ONLY_BLOCK, (_match, variantsRaw: string, inner: string) => {
    const variants = parseVariantList(variantsRaw);
    return variants.includes(variant) ? inner : "";
  });
  result = result.replace(EXCEPT_BLOCK, (_match, variantsRaw: string, inner: string) => {
    const variants = parseVariantList(variantsRaw);
    return variants.includes(variant) ? "" : inner;
  });
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/variantBlocks.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/variantBlocks.ts src/lib/letters/variantBlocks.test.ts
git commit -m "feat: add [只有]/[除外] variant conditional block parser"
```

---

### Task 4: Slot-Count Conditional Block Parser (TDD)

**Files:**
- Create: `src/lib/letters/slotBlocks.ts`
- Create: `src/lib/letters/slotBlocks.test.ts`

**Interfaces:**
- Produces: `resolveSlotBlocks(text: string, slotCount: number): string` — Task 7's rewritten `render.ts` calls this alongside `resolveVariantBlocks`.

- [ ] **Step 1: Write the failing test `src/lib/letters/slotBlocks.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveSlotBlocks } from "./slotBlocks";

describe("resolveSlotBlocks", () => {
  const text =
    "[單一時段]單一時段文字 {{sessionSlots}}[/單一時段]" +
    "[多個時段]多時段文字 {{sessionSlots}}[/多個時段]";

  it("keeps only the single-slot block when slotCount is 1", () => {
    expect(resolveSlotBlocks(text, 1)).toBe("單一時段文字 {{sessionSlots}}");
  });

  it("keeps only the multi-slot block when slotCount is 2 or more", () => {
    expect(resolveSlotBlocks(text, 2)).toBe("多時段文字 {{sessionSlots}}");
  });

  it("keeps neither block when slotCount is 0", () => {
    expect(resolveSlotBlocks(text, 0)).toBe("");
  });

  it("leaves text with no slot blocks untouched", () => {
    expect(resolveSlotBlocks("沒有任何時段區塊的文字", 1)).toBe("沒有任何時段區塊的文字");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/slotBlocks.test.ts`
Expected: FAIL with "Cannot find module './slotBlocks'".

- [ ] **Step 3: Write `src/lib/letters/slotBlocks.ts`**

```ts
const SINGLE_BLOCK = /\[單一時段\]([\s\S]*?)\[\/單一時段\]/g;
const MULTI_BLOCK = /\[多個時段\]([\s\S]*?)\[\/多個時段\]/g;

export function resolveSlotBlocks(text: string, slotCount: number): string {
  let result = text.replace(SINGLE_BLOCK, (_match, inner: string) => (slotCount === 1 ? inner : ""));
  result = result.replace(MULTI_BLOCK, (_match, inner: string) => (slotCount >= 2 ? inner : ""));
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/slotBlocks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/slotBlocks.ts src/lib/letters/slotBlocks.test.ts
git commit -m "feat: add [單一時段]/[多個時段] slot-count conditional block parser"
```

---

### Task 5: Bold+Highlight Markup Parser (TDD)

**Files:**
- Create: `src/lib/letters/highlightMarkup.ts`
- Create: `src/lib/letters/highlightMarkup.test.ts`

**Interfaces:**
- Produces: `toHighlightedHtml(text: string): string`, `stripHighlightMarkers(text: string): string` — Task 12's generate API route calls both on the fully-rendered letter text (after variable substitution) to produce the HTML clipboard payload and the plain-text fallback respectively.

- [ ] **Step 1: Write the failing test `src/lib/letters/highlightMarkup.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { toHighlightedHtml, stripHighlightMarkers } from "./highlightMarkup";

describe("toHighlightedHtml", () => {
  it("wraps **text** in a bold+highlight span and leaves plain text untouched", () => {
    const result = toHighlightedHtml("已為您媒合心理師 **王小明**，請確認");
    expect(result).toBe('已為您媒合心理師 <b style="background-color:#fff59d">王小明</b>，請確認');
  });

  it("handles multiple highlighted spans in the same text", () => {
    const result = toHighlightedHtml("**A** 與 **B**");
    expect(result).toBe('<b style="background-color:#fff59d">A</b> 與 <b style="background-color:#fff59d">B</b>');
  });

  it("converts newlines to <br> for HTML display", () => {
    expect(toHighlightedHtml("第一行\n第二行")).toBe("第一行<br>第二行");
  });

  it("escapes HTML special characters in plain text", () => {
    expect(toHighlightedHtml("A<B>C")).toBe("A&lt;B&gt;C");
  });
});

describe("stripHighlightMarkers", () => {
  it("removes ** markers while keeping the wrapped text", () => {
    expect(stripHighlightMarkers("已媒合 **王小明** 心理師")).toBe("已媒合 王小明 心理師");
  });

  it("leaves text with no markers untouched", () => {
    expect(stripHighlightMarkers("沒有標記的文字")).toBe("沒有標記的文字");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/highlightMarkup.test.ts`
Expected: FAIL with "Cannot find module './highlightMarkup'".

- [ ] **Step 3: Write `src/lib/letters/highlightMarkup.ts`**

```ts
const HIGHLIGHT_PATTERN = /\*\*(.+?)\*\*/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toHighlightedHtml(text: string): string {
  const segments = text.split(HIGHLIGHT_PATTERN);
  const html = segments
    .map((segment, index) =>
      index % 2 === 1 ? `<b style="background-color:#fff59d">${escapeHtml(segment)}</b>` : escapeHtml(segment)
    )
    .join("");
  return html.replace(/\n/g, "<br>");
}

export function stripHighlightMarkers(text: string): string {
  return text.replace(HIGHLIGHT_PATTERN, "$1");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/highlightMarkup.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/highlightMarkup.ts src/lib/letters/highlightMarkup.test.ts
git commit -m "feat: add **text** bold+highlight markup parser (HTML and plain-text output)"
```

---

### Task 6: Signature Block Builder (TDD)

**Files:**
- Create: `src/lib/letters/signature.ts`
- Create: `src/lib/letters/signature.test.ts`

**Interfaces:**
- Produces: `SignatureOptions` (`{ operatorSignature: string; includeLine: boolean }`), `buildSignatureBlock(options: SignatureOptions): string` — Task 12's generate API route calls this and appends the result to the rendered body.

- [ ] **Step 1: Write the failing test `src/lib/letters/signature.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildSignatureBlock } from "./signature";

describe("buildSignatureBlock", () => {
  it("builds the base signature block with the operator's code, no LINE line by default", () => {
    const result = buildSignatureBlock({ operatorSignature: "TA", includeLine: false });
    expect(result).toBe("如果有其他需協助的地方歡迎和我們聯繫，謝謝！\n敬祝　平安順心\n加惠行政團隊 TA");
  });

  it("includes the LINE contact line when requested", () => {
    const result = buildSignatureBlock({ operatorSignature: "TA", includeLine: true });
    expect(result).toBe(
      "如果有其他需協助的地方歡迎和我們聯繫，謝謝！\n(可選)也可以加我們的官方LINE做聯繫：@775jyvbp\n敬祝　平安順心\n加惠行政團隊 TA"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/signature.test.ts`
Expected: FAIL with "Cannot find module './signature'".

- [ ] **Step 3: Write `src/lib/letters/signature.ts`**

```ts
export interface SignatureOptions {
  operatorSignature: string;
  includeLine: boolean;
}

const LINE_CONTACT_LINE = "(可選)也可以加我們的官方LINE做聯繫：@775jyvbp";

export function buildSignatureBlock(options: SignatureOptions): string {
  const lines = ["如果有其他需協助的地方歡迎和我們聯繫，謝謝！"];
  if (options.includeLine) {
    lines.push(LINE_CONTACT_LINE);
  }
  lines.push("敬祝　平安順心", `加惠行政團隊 ${options.operatorSignature}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/signature.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/signature.ts src/lib/letters/signature.test.ts
git commit -m "feat: add fixed signature block builder with optional LINE contact line"
```

---

### Task 7: Rewire `renderLetter` to Use Variant/Slot Block Resolution

**Files:**
- Modify: `src/lib/letters/render.ts`
- Modify: `src/lib/letters/render.test.ts`

**Interfaces:**
- Consumes: `resolveVariantBlocks` (Task 3), `resolveSlotBlocks` (Task 4).
- Produces: `RenderInput` now includes an optional `slotCount?: number`; `renderLetter(input: RenderInput): string`, `MissingFieldsError` (unchanged signature) — Task 12's generate API route calls `renderLetter` twice per request (once for `subject`, once for `body`), passing the same `fields`/`variant`/`slotCount`.

This replaces phase 1's Handlebars-only variant conditional (`{{#if (eq variant "EAP")}}`) with the new bracket-based syntax — old-syntax templates are no longer supported (acceptable: Task 1 already reset the dev database, and Task 14 seeds fresh content in the new syntax).

- [ ] **Step 1: Replace `src/lib/letters/render.test.ts` entirely**

```ts
import { describe, it, expect } from "vitest";
import { renderLetter, MissingFieldsError } from "./render";

describe("renderLetter", () => {
  const templateBody =
    "親愛的 {{caseRef}}：心理師為 {{therapistName}}。" +
    "[只有 EAP]本次由 EAP 支付。[/只有]" +
    "[除外 EAP]請自費。[/除外]";

  it("substitutes fields and keeps the matching variant block", () => {
    const result = renderLetter({
      templateBody,
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
      variant: "EAP",
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。本次由 EAP 支付。");
  });

  it("falls back to the [除外] block for a non-matching variant", () => {
    const result = renderLetter({
      templateBody,
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
      variant: "一般",
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。請自費。");
  });

  it("throws MissingFieldsError listing every empty required field", () => {
    expect(() =>
      renderLetter({
        templateBody,
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "", therapistName: "" },
        variant: "一般",
      })
    ).toThrowError(MissingFieldsError);
  });

  it("lists exactly the missing field names on the thrown error", () => {
    try {
      renderLetter({
        templateBody,
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "A001", therapistName: "" },
        variant: "一般",
      });
      throw new Error("expected renderLetter to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFieldsError);
      expect((err as MissingFieldsError).missingFields).toEqual(["therapistName"]);
    }
  });

  it("resolves slot blocks using slotCount alongside variant blocks", () => {
    const result = renderLetter({
      templateBody: "[單一時段]時間為 {{sessionSlots}}[/單一時段][多個時段]候選時間：{{sessionSlots}}[/多個時段]",
      requiredFields: ["sessionSlots"],
      fields: { sessionSlots: "7/22 (三) 19:00-20:20" },
      variant: "不適用",
      slotCount: 1,
    });
    expect(result).toBe("時間為 7/22 (三) 19:00-20:20");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/render.test.ts`
Expected: FAIL — old `render.ts` still uses `{{#if (eq variant ...)}}` syntax, so the new bracket-syntax tests produce wrong output (brackets pass through literally).

- [ ] **Step 3: Replace `src/lib/letters/render.ts` entirely**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/render.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/render.ts src/lib/letters/render.test.ts
git commit -m "feat: rewire renderLetter to use bracket-based variant/slot block resolution"
```

---

### Task 8: Gmail Compose URL — Optional to/bcc, No Auto-Filled Body

**Files:**
- Modify: `src/lib/letters/gmailUrl.ts`
- Modify: `src/lib/letters/gmailUrl.test.ts`

**Interfaces:**
- Produces: `GmailDraftInput` (`{ to?: string; bcc?: string; subject: string; body?: string }`), `buildGmailComposeUrl(input: GmailDraftInput): string` — Task 13's generate page calls this with `to`/`bcc` (comma-joined from the multi-recipient lists) and `subject` only, omitting `body` (per the design's Option A: body is pasted from the clipboard, not URL-filled, since the URL param cannot carry the bold/highlight formatting).

- [ ] **Step 1: Replace `src/lib/letters/gmailUrl.test.ts` entirely**

```ts
import { describe, it, expect } from "vitest";
import { buildGmailComposeUrl } from "./gmailUrl";

describe("buildGmailComposeUrl", () => {
  it("includes to, bcc, and subject when all are provided", () => {
    const url = buildGmailComposeUrl({
      to: "case@example.com",
      bcc: "internal@example.com",
      subject: "媒合通知",
    });
    const params = new URL(url).searchParams;
    expect(params.get("to")).toBe("case@example.com");
    expect(params.get("bcc")).toBe("internal@example.com");
    expect(params.get("su")).toBe("媒合通知");
  });

  it("omits the to param when no recipient is given (BCC-only case)", () => {
    const url = buildGmailComposeUrl({ bcc: "internal@example.com", subject: "主旨" });
    const params = new URL(url).searchParams;
    expect(params.has("to")).toBe(false);
    expect(params.get("bcc")).toBe("internal@example.com");
  });

  it("joins multiple recipients as a comma-separated to param", () => {
    const url = buildGmailComposeUrl({ to: "a@example.com,b@example.com", subject: "主旨" });
    expect(new URL(url).searchParams.get("to")).toBe("a@example.com,b@example.com");
  });

  it("omits the body param when no body is given", () => {
    const url = buildGmailComposeUrl({ to: "a@example.com", subject: "主旨" });
    expect(new URL(url).searchParams.has("body")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/gmailUrl.test.ts`
Expected: FAIL — old `buildGmailComposeUrl` requires `to`/`body` as mandatory fields and always sets `body`.

- [ ] **Step 3: Replace `src/lib/letters/gmailUrl.ts` entirely**

```ts
export interface GmailDraftInput {
  to?: string;
  bcc?: string;
  subject: string;
  body?: string;
}

export function buildGmailComposeUrl(input: GmailDraftInput): string {
  const params = new URLSearchParams({ view: "cm", fs: "1" });
  if (input.to) params.set("to", input.to);
  if (input.bcc) params.set("bcc", input.bcc);
  params.set("su", input.subject);
  if (input.body) params.set("body", input.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/gmailUrl.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/gmailUrl.ts src/lib/letters/gmailUrl.test.ts
git commit -m "feat: support optional to/bcc/body in Gmail compose URL builder"
```

---

### Task 9: Templates CRUD API — Subject & Variants Array

**Files:**
- Modify: `src/app/api/templates/route.ts`
- Modify: `src/app/api/templates/[id]/route.ts`

**Interfaces:**
- Consumes: `encodeRequiredFields`, `decodeRequiredFields` (phase 1's `src/lib/letters/requiredFields.ts`, unchanged — reused for `variants` since it's the same JSON-string-array-in-SQLite pattern); `findUndeclaredFields` (phase 1's `src/lib/letters/templateFields.ts`, unchanged).
- Produces: `GET/POST /api/templates`, `PUT /api/templates/:id` now accept/return `subject: string` and `variants: string[]` (decoded) instead of `variant: string` — Task 10's UI and Task 13's generate page consume this shape.

- [ ] **Step 1: Replace `src/app/api/templates/route.ts` entirely**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return {
    ...template,
    requiredFields: decodeRequiredFields(template.requiredFields),
    variants: decodeRequiredFields(template.variants),
  };
}

export async function GET() {
  const templates = await prisma.template.findMany({ orderBy: { category: "asc" } });
  return NextResponse.json(templates.map(serializeTemplate));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { category, subject, body, variants, requiredFields } = await request.json();
  if (!category || !subject || !body) {
    return NextResponse.json({ error: "類別、標題、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const declaredVariants: string[] = variants && variants.length > 0 ? variants : ["不適用"];

  const template = await prisma.template.create({
    data: {
      category,
      subject,
      body,
      variants: encodeRequiredFields(declaredVariants),
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields }, { status: 201 });
}
```

- [ ] **Step 2: Replace `src/app/api/templates/[id]/route.ts` entirely**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return {
    ...template,
    requiredFields: decodeRequiredFields(template.requiredFields),
    variants: decodeRequiredFields(template.variants),
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { category, subject, body, variants, requiredFields } = await request.json();
  const declaredFields: string[] = requiredFields ?? [];
  const declaredVariants: string[] = variants && variants.length > 0 ? variants : ["不適用"];

  const template = await prisma.template.update({
    where: { id },
    data: {
      category,
      subject,
      body,
      variants: encodeRequiredFields(declaredVariants),
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields });
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev &`, wait a few seconds:
```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/select \
  -H "Content-Type: application/json" \
  -d '{"userId":"seed-user-admin"}' > /dev/null
curl -s -b cookies.txt -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{"category":"測試類別","subject":"【測試】{{caseRef}}","body":"{{caseRef}} {{groupName}}","variants":["一般","EAP"],"requiredFields":["caseRef"]}'
```
Expected: HTTP 201, JSON containing `"variants":["一般","EAP"]` (decoded array), `"subject":"【測試】{{caseRef}}"`, `"undeclaredFields":["groupName"]`.

Stop the dev server (`kill %1`) and delete `cookies.txt`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/templates
git commit -m "feat: update templates CRUD API for subject and variants array"
```

---

### Task 10: Template Editor UI — Subject & Variants Input

**Files:**
- Modify: `src/app/templates/page.tsx`

**Interfaces:**
- Consumes: `GET/POST/PUT /api/templates` (Task 9) — response/request shape now includes `subject: string` and `variants: string[]`.

- [ ] **Step 1: Replace `src/app/templates/page.tsx` entirely**

```tsx
"use client";

import { useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  category: string;
  subject: string;
  body: string;
  variants: string[];
  requiredFields: string[];
}

interface FormState {
  category: string;
  subject: string;
  body: string;
  variantsText: string;
  requiredFieldsText: string;
}

const EMPTY_FORM: FormState = { category: "", subject: "", body: "", variantsText: "不適用", requiredFieldsText: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [warning, setWarning] = useState<string[]>([]);

  async function load() {
    const res = await fetch("/api/templates");
    setTemplates(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(t: TemplateItem) {
    setEditingId(t.id);
    setForm({
      category: t.category,
      subject: t.subject,
      body: t.body,
      variantsText: t.variants.join(", "),
      requiredFieldsText: t.requiredFields.join(", "),
    });
    setWarning([]);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setWarning([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const variants = form.variantsText
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    const requiredFields = form.requiredFieldsText
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, subject: form.subject, body: form.body, variants, requiredFields }),
    });
    const data = await res.json();
    setWarning(data.undeclaredFields ?? []);
    setEditingId(null);
    setForm(EMPTY_FORM);
    await load();
  }

  return (
    <main>
      <h1>模板管理</h1>
      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {t.category}（{t.variants.join("、")}）
            <button type="button" onClick={() => startEdit(t)}>
              編輯
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? "編輯模板" : "新增模板"}</h2>
        <label>
          類別
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        </label>
        <label>
          適用方案（用逗號分隔，例如：一般, 伴侶, 青壯；沒有方案差異就填「不適用」）
          <input
            value={form.variantsText}
            onChange={(e) => setForm({ ...form, variantsText: e.target.value })}
            required
          />
        </label>
        <label>
          標題
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        </label>
        <label>
          內文
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={14} />
        </label>
        <p>
          語法提示：
          <br />
          方案差異：<code>[只有 EAP]...[/只有]</code>、<code>[除外 EAP]...[/除外]</code>（多個方案用「、」分隔）
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
        <button type="submit">{editingId ? "儲存修改" : "新增模板"}</button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
      </form>
      {warning.length > 0 && (
        <p role="alert">注意：內文引用了未宣告的欄位（{warning.join("、")}），請確認拼字是否正確。</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev &`, wait a few seconds. In a browser, open `http://localhost:3000/select`, pick "測試人員", open `http://localhost:3000/templates`. Confirm the seeded "媒合信（測試）（一般、EAP）" appears. Edit it, confirm the 標題 and 適用方案 fields show the seeded values, save, reload, confirm changes persisted.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/templates/page.tsx
git commit -m "feat: add subject and variants inputs to template editor UI"
```

---

### Task 11: Therapist Email/Note — API & UI

**Files:**
- Modify: `src/app/api/therapists/route.ts`
- Modify: `src/app/api/therapists/[id]/route.ts`
- Modify: `src/app/therapists/page.tsx`

**Interfaces:**
- Produces: `POST/PUT` therapist endpoints now accept optional `email`, `note`; `GET /api/therapists` already returns full rows (including the new columns) unchanged.

- [ ] **Step 1: Modify `src/app/api/therapists/route.ts`**

Replace the `POST` handler body:

```ts
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { name, email, note } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "姓名為必填" }, { status: 400 });
  }

  const therapist = await prisma.therapist.create({
    data: { name, email: email || null, note: note || null },
  });
  return NextResponse.json(therapist, { status: 201 });
}
```

(The `GET` handler is unchanged.)

- [ ] **Step 2: Modify `src/app/api/therapists/[id]/route.ts`**

Replace the `PUT` handler body:

```ts
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { name, isActive, email, note } = await request.json();

  const therapist = await prisma.therapist.update({
    where: { id },
    data: { name, isActive, email: email || null, note: note || null },
  });

  return NextResponse.json(therapist);
}
```

- [ ] **Step 3: Replace `src/app/therapists/page.tsx` entirely**

```tsx
"use client";

import { useEffect, useState } from "react";

interface TherapistItem {
  id: string;
  name: string;
  isActive: boolean;
  email: string | null;
  note: string | null;
}

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function load() {
    const res = await fetch("/api/therapists?includeInactive=true");
    setTherapists(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(t: TherapistItem) {
    setEditingId(t.id);
    setName(t.name);
    setEmail(t.email ?? "");
    setNote(t.note ?? "");
    setIsActive(t.isActive);
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setEmail("");
    setNote("");
    setIsActive(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/therapists/${editingId}` : "/api/therapists";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, note, isActive }),
    });
    setEditingId(null);
    setName("");
    setEmail("");
    setNote("");
    setIsActive(true);
    await load();
  }

  return (
    <main>
      <h1>心理師名單管理</h1>
      <ul>
        {therapists.map((t) => (
          <li key={t.id}>
            {t.name}
            {!t.isActive && "（已停用）"}
            {t.email && ` · ${t.email}`}
            {t.note && ` · ${t.note}`}
            <button type="button" onClick={() => startEdit(t)}>
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
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            啟用中（取消勾選可停用，不會出現在產信下拉選單）
          </label>
        )}
        <button type="submit">{editingId ? "儲存修改" : "新增心理師"}</button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev &`, wait a few seconds. Open `/select`, pick "測試人員", open `/therapists`. Confirm "測試心理師A" shows its seeded email/note. Add a new therapist with an email and note, confirm it appears in the list with both values shown.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/therapists src/app/therapists/page.tsx
git commit -m "feat: add email and note fields to therapist management"
```

---

### Task 12: Letter Generation API — Subject Rendering, Signature, Highlight Output

**Files:**
- Modify: `src/app/api/letters/generate/route.ts`

**Interfaces:**
- Consumes: `renderLetter`, `MissingFieldsError` (Task 7); `decodeRequiredFields` (phase 1, unchanged); `toHighlightedHtml`, `stripHighlightMarkers` (Task 5); `buildSignatureBlock` (Task 6).
- Produces: `POST /api/letters/generate` now accepts `{ templateId, variant, fields, slotCount?, includeLine? }` and returns `{ renderedSubject: string; renderedBodyHtml: string; renderedBodyPlain: string }` on success, or `{ error, missingFields }` (400) on validation failure — Task 13's generate page consumes this shape.

- [ ] **Step 1: Replace `src/app/api/letters/generate/route.ts` entirely**

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

  const { templateId, fields, variant, slotCount, includeLine } = await request.json();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "找不到模板" }, { status: 404 });
  }

  const requiredFields = decodeRequiredFields(template.requiredFields);

  let renderedSubject: string;
  let renderedBody: string;
  try {
    renderedSubject = renderLetter({ templateBody: template.subject, requiredFields, fields, variant, slotCount });
    renderedBody = renderLetter({ templateBody: template.body, requiredFields, fields, variant, slotCount });
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

  // Audit log intentionally excludes caseRef, recipient email, and the rendered body itself.
  await prisma.letterLog.create({
    data: { userId: session.userId, templateId: template.id },
  });

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
git commit -m "feat: render subject, append signature block, output HTML+plain highlight formats"
```

---

### Task 13: Letter Generation UI — Date/Slot Pickers, Multi To/BCC, Copy+Open Gmail

**Files:**
- Modify: `src/app/generate/page.tsx`

**Interfaces:**
- Consumes: `buildGmailComposeUrl` (Task 8); `formatSessionSlot`, `formatSessionSlots`, `SessionSlotInput` (Task 2); `GET /api/templates` (now returns `subject`, `variants: string[]`, per Task 9); `POST /api/letters/generate` (now returns `{ renderedSubject, renderedBodyHtml, renderedBodyPlain }`, per Task 12).

- [ ] **Step 1: Replace `src/app/generate/page.tsx` entirely**

```tsx
"use client";

import { useEffect, useState } from "react";
import { buildGmailComposeUrl } from "@/lib/letters/gmailUrl";
import { formatSessionSlot, formatSessionSlots, type SessionSlotInput } from "@/lib/letters/dateFormat";

interface TemplateItem {
  id: string;
  category: string;
  subject: string;
  variants: string[];
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
  const [templateId, setTemplateId] = useState("");
  const [variant, setVariant] = useState("");
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

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const showVariantPicker = (selectedTemplate?.variants.length ?? 0) > 1;

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const t = templates.find((item) => item.id === id);
    setVariant(t?.variants[0] ?? "");
    setTextFields({});
    setSessionDateValue(EMPTY_SLOT);
    setSessionSlotValues([EMPTY_SLOT]);
    setResult(null);
    setError("");
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
      body: JSON.stringify({ templateId, variant, fields, slotCount, includeLine }),
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
          信件模板
          <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} required>
            <option value="">請選擇</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.category}
              </option>
            ))}
          </select>
        </label>

        {showVariantPicker && selectedTemplate && (
          <label>
            方案
            <select value={variant} onChange={(e) => setVariant(e.target.value)} required>
              {selectedTemplate.variants.map((v) => (
                <option key={v} value={v}>
                  {v}
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
                    <input type="date" value={slot.date} onChange={(e) => updateSlot(index, { date: e.target.value })} />
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                    />
                    至
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlot(index, { endTime: e.target.value })}
                    />
                    {sessionSlotValues.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSessionSlotValues(sessionSlotValues.filter((_, i) => i !== index))}
                      >
                        刪除
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setSessionSlotValues([...sessionSlotValues, EMPTY_SLOT])}>
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
                <button type="button" onClick={() => setToEmails(toEmails.filter((_, i) => i !== index))}>
                  刪除
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setToEmails([...toEmails, ""])}>
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
                <button type="button" onClick={() => setBccEmails(bccEmails.filter((_, i) => i !== index))}>
                  刪除
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setBccEmails([...bccEmails, ""])}>
            新增密件副本
          </button>
        </fieldset>

        <label>
          <input type="checkbox" checked={includeLine} onChange={(e) => setIncludeLine(e.target.checked)} />
          附加官方 LINE 聯繫方式
        </label>

        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={!templateId}>
          產生信件
        </button>
      </form>
      {result && (
        <section>
          <h2>產出結果</h2>
          <p>主旨：{result.subject}</p>
          <div dangerouslySetInnerHTML={{ __html: result.html }} />
          <button onClick={handleCopyAndOpenGmail}>複製格式化內文並開啟 Gmail 草稿</button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Manual end-to-end verification**

Run: `npm run dev &`, wait a few seconds. Open `/select`, pick "測試人員", open `/generate`, select "媒合信（測試）". Confirm the 方案 dropdown shows 一般/EAP, the 心理師 dropdown and 日期時段 picker appear, 個案代號 box appears. Pick EAP, fill a therapist, a date+time range, a case ref, one 收件者 email, click 產生信件. Confirm the preview shows the therapist name and date bolded with a yellow background (inspect via browser devtools if needed) and the EAP-specific sentence appears. Click 複製格式化內文並開啟 Gmail 草稿, confirm a new tab opens to `mail.google.com` with 收件者/主旨 pre-filled, then paste (Ctrl+V) into the body and confirm the bold/yellow formatting survives the paste.

Then confirm the BCC-only case: clear the 收件者 field, fill only a BCC email, regenerate, click the button again, confirm the Gmail tab opens with only BCC filled and no `to` param error.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/generate/page.tsx
git commit -m "feat: add date/slot pickers, multi to/bcc, and clipboard copy+Gmail flow to generate page"
```

---

### Task 14: Seed Real Content — 線上諮詢預約確認信 & 通訊諮商預約確認信

**Files:**
- Create: `prisma/import-real-templates.ts`

**Interfaces:**
- None (one-time script, run manually via `npx tsx prisma/import-real-templates.ts`). Uses `@prisma/client` directly, same pattern as `prisma/seed.ts` but kept as a separate script since this is real clinic content, not synthetic test data — it should not re-run on every `prisma db seed` invocation.

This task seeds the two simplest real categories (single-variant, no variant/slot conditional blocks needed) end-to-end as a concrete proof the new pipeline renders real content correctly. The multi-variant categories (媒合信, 準備信 — 6 variants each) require careful editorial judgment to merge into shared-body + condition blocks per the "reduce differences" principle from the design doc, which is better done interactively with the user reviewing each simplification — that merge is the next follow-up after this plan ships, not part of this task.

- [ ] **Step 1: Write `prisma/import-real-templates.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { id: "seed-user-admin" } });
  if (!admin) {
    throw new Error("找不到 seed-user-admin，請先執行 npx prisma db seed");
  }

  await prisma.template.upsert({
    where: { id: "real-template-online-consult-confirm" },
    update: {},
    create: {
      id: "real-template-online-consult-confirm",
      category: "線上諮詢預約確認信",
      subject: "[加惠心理諮商]預約{{sessionDate}} {{therapistName}}心理師線上諮詢，收到信件煩請回覆確認(諮詢結束後請於24小時內完成付款)",
      body:
        "{{caseRef}}您好：\n\n" +
        "加惠行政團隊為您預約 **{{sessionDate}}(台灣時間)** 與 **{{therapistName}}** 諮商心理師的線上諮詢，\n" +
        "**收到信件請回信告知，以確認預約。**\n\n" +
        "諮詢結束後，**麻煩您完成匯款後，將匯款資訊回覆到這個信箱(請提供完整收據或是手機轉帳成功的畫面)**。\n\n" +
        "以下是您此次的預約資訊：\n" +
        "預約心理師：**{{therapistName}}**心理師\n" +
        "預約時間：**{{sessionDate}}**\n" +
        "諮詢收費：**{{fee}}**元\n" +
        "諮詢連結：{{meetLink}}\n\n" +
        "【付款方式】\n" +
        "匯款帳號： 266-03-500923-0\n" +
        "國泰世華 （銀行代號013）\n" +
        "戶名: 財團法人加惠文教基金會附設心理諮商所張卉湄\n\n" +
        "麻煩您完成匯款後，將匯款資訊回覆到這個信箱（請提供完整收據或是手機轉帳成功的畫面）\n\n" +
        "【注意事項】\n" +
        "會談前準備：\n" +
        "1. 請先確認您的電腦或行動裝置已安裝Google Meet，您已註冊且能順利使用。\n" +
        "2. 在會談時間前先行備妥您的身分證明文件，並檢查您的電腦或行動裝置的耳機（或喇叭）、麥克風和網路攝影機設備可用性，以免耽誤您的寶貴諮詢時間。\n\n" +
        "線上會談須知：\n" +
        "1. 線上諮詢有潛在的優勢與風險（如：當事人保密的限制）而與面對面有所不同。保密原則仍適用於線上諮詢，雙方不得在未經對方知情同意之情況下對諮詢內容進行截圖、錄影、錄音、或使他人從旁觀看、或進行網路直播等。如發生相關情形，經勸阻無效，機構將尋求法律途徑處理。\n" +
        "2. 若對此預約有任何疑問，您可以：\n" +
        "   A. E-mail至mail@jcf.org.tw通知我們\n" +
        "   B. 或歡迎來電02-2558-2771洽詢",
      variants: JSON.stringify(["不適用"]),
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate", "fee", "meetLink"]),
      updatedById: admin.id,
    },
  });

  await prisma.template.upsert({
    where: { id: "real-template-remote-consult-confirm" },
    update: {},
    create: {
      id: "real-template-remote-consult-confirm",
      category: "通訊諮商預約確認信",
      subject: "[加惠心理諮商]預約{{sessionDate}}{{therapistName}}心理師通訊諮商，收到信件煩請回覆確認(諮商結束後請於24小時內完成付款)",
      body:
        "{{caseRef}}小姐 您好，\n\n" +
        "加惠行政團隊已為您預約 **{{sessionDate}}** 與**{{therapistName}}**心理師的通訊心理諮商。\n" +
        "**收到信件請回信告知，以確認預約**，\n" +
        "若未能收到您的回覆，諮商前將有人與您電話聯繫確認，如造成您的不便還請見諒。\n\n" +
        "諮商結束後，**麻煩您完成匯款後，將匯款資訊回覆到這個信箱(請提供完整收據或是手機轉帳成功的畫面)**。\n\n" +
        "以下是您此次的預約資訊：\n\n" +
        "預約心理師：**{{therapistName}}** 心理師\n" +
        "預約時間：**{{sessionDate}}**\n" +
        "諮商收費：**{{fee}}**元\n" +
        "諮商連結：{{meetLink}}\n\n" +
        "【付款方式】\n" +
        "匯款帳號：266-03-500923-0\n" +
        "國泰世華（銀行代號013），永平分行\n" +
        "戶名：財團法人加惠文教基金會附設心理諮商所張卉湄\n" +
        "麻煩您完成匯款後，將匯款資訊回覆到這個信箱(請提供完整收據或是手機轉帳成功的畫面)。\n\n" +
        "【注意事項】\n" +
        "諮商前準備：\n" +
        "1. 請先確認您的電腦或行動裝置已安裝Google Meet，您已註冊且能順利使用。\n" +
        "2. 在會談時間前先行備妥您的身分證明文件，並檢查您的電腦或行動裝置的耳機（或喇叭）、麥克風和網路攝影機設備可用性，以免耽誤您的寶貴諮商時間。\n\n" +
        "線上諮商須知：\n" +
        "1. 進入通訊諮商的線上會議室時，請準備好含照片的身分證明文件，並確認心理師的執業證明，核實雙方身分後方可開始進行心理諮商。\n" +
        "2. 通訊心理諮商有潛在的優勢與風險（如：當事人保密的限制）而與面對面有所不同。保密原則仍適用於通訊心理諮商服務，雙方不得在未經對方知情同意之情況下對諮商內容進行截圖、錄影、錄音、或使他人從旁觀看、或進行網路直播等。如發生相關情形，經勸阻無效，機構將尋求法律途徑處理。\n" +
        "3. 若對此預約有任何疑問，您可以：\n" +
        "   A. E-mail至mail@jcf.org.tw通知我們；\n" +
        "   B. 來電02-2558-2771洽詢。",
      variants: JSON.stringify(["不適用"]),
      requiredFields: JSON.stringify(["caseRef", "therapistName", "sessionDate", "fee", "meetLink"]),
      updatedById: admin.id,
    },
  });

  console.log("Real template content imported (線上諮詢預約確認信, 通訊諮商預約確認信).");
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

- [ ] **Step 2: Run the import script, twice, to confirm idempotency**

Run: `npx tsx prisma/import-real-templates.ts`
Expected: "Real template content imported (線上諮詢預約確認信, 通訊諮商預約確認信)."
Run again immediately — expected: same message, no duplicate rows (fixed-id `upsert`).

- [ ] **Step 3: Manual verification**

Run: `npm run dev &`, open `/select`, pick "測試人員", open `/generate`, select "線上諮詢預約確認信". Confirm no 方案 dropdown appears (single variant), fill all required fields including 個案代號/心理師/日期/`fee`/`meetLink`, generate, confirm the bank transfer info and bolded time/fee/therapist name render correctly with no leftover `**` markers or unresolved `{{...}}` placeholders.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add prisma/import-real-templates.ts
git commit -m "feat: import real content for 線上諮詢預約確認信 and 通訊諮商預約確認信"
```

---

## Follow-Up (Not in This Plan)

- **媒合信／準備信 內容整併（6 種方案）**：需要人工判斷哪些措辭差異該保留、哪些該簡化合併成共用主體，比照 Task 14 的方式寫一支 `prisma/import-real-templates.ts` 追加內容，但要跟使用者逐段確認簡化結果，不適合單方面批次處理。
- **諮商時間調整信、錄取信、候補信、額滿信**：內容尚未提供，架構已就緒，內容到齊後可直接比照 Task 14 的模式匯入。
- **UI 美化、頁面導覽整理**：使用者已表明另開一輪處理。
- **Gmail 草稿全自動寫入（IMAP + App Password）**：待共用帳號確認能否開啟兩步驟驗證後再評估，見設計文件「已知限制與後續規劃」。
