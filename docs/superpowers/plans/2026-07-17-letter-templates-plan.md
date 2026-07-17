# 信件模板系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-1 letter-template system per `docs/superpowers/specs/2026-07-16-letter-templates-design.md` — self-service template CRUD, letter generation with placeholder/variant substitution, Gmail draft prefill, and a minimal audit log.

**Architecture:** Next.js (TypeScript, App Router) single project serving both UI and API routes; SQLite (single file) via Prisma ORM; session-based operator identification (iron-session, name-selection, no password); Handlebars-based rendering engine for templates.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Prisma 6, SQLite, iron-session, handlebars, Vitest.

## Global Constraints

- Never write real case data anywhere in this repo or in prompts to any AI model — all seed/test data must be synthetic (per spec "隱私與資料處理備註" and project-wide hard rule).
- Frontend is TypeScript; backend must not be PHP (satisfied by Next.js/Node).
- Scale is small by design (≤5 staff, ~1000 case references, ~30 therapists) — per explicit user feedback, do not add infrastructure or auth complexity sized for a larger deployment than this actually is.
- **No password/credential verification.** Operator identification is a simple "pick your name from a fixed list" — the session exists only to remember who is currently operating for signature/audit attribution. This is a deliberate, accepted trade-off: any operator can select any name, including someone else's, and nothing prevents it. Do not add password fields, hashing, or credential checks back in.
- SQLite has no native array column type — `Template.requiredFields` is stored as a JSON-encoded string column and must be encoded/decoded at the application boundary (see Task 3).
- Phase 1 has no HTTPS, no domain, no LAN/public network exposure — `localhost` only.
- Self-service template add/edit must work from the UI with no code deploy required (non-negotiable per spec).
- Recipient email is entered per-use and must never be persisted to the database or the audit log.
- `letters_log` (audit log) records only who/when/which template — never the case reference or rendered letter body.

---

### Task 1: Project Scaffold & SQLite Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `.env.example`
- Modify: `.gitignore` (add `.env`, `.next/`, `*.db`, `*.db-journal`)

**Interfaces:**
- Produces: a running Next.js dev server at `http://localhost:3000`, a `DATABASE_URL` env convention Task 2's Prisma client relies on.

- [ ] **Step 1: Write `package.json`**

No `bcryptjs`/`@types/bcryptjs` — there is no password hashing in this project (see Global Constraints).

```json
{
  "name": "framing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.0.0",
    "iron-session": "^8.0.0",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.15.0",
    "vitest": "^2.0.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Write `src/app/layout.tsx`**

```tsx
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

- [ ] **Step 5: Write `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>信件模板系統</h1>
      <p>本機測試階段</p>
    </main>
  );
}
```

- [ ] **Step 6: Write `.env.example`**

Note: Prisma resolves a SQLite `file:` URL relative to `prisma/schema.prisma`'s directory, not the project root. So `file:./dev.db` here will end up creating `prisma/dev.db` once Task 2 adds `prisma/schema.prisma` — this is expected, not a bug. Task 10's backup script accounts for this path.

```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="change-this-to-a-random-32-character-minimum-string"
```

- [ ] **Step 7: Update `.gitignore`**

Add these lines if not already present (the `*.db`/`*.db-journal` entries keep the actual SQLite data file — which will live under `prisma/`, see Step 6's note — out of git regardless of its exact path):
```
.env
.next/
*.db
*.db-journal
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes with no error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Create `.env`**

Copy `.env.example` to `.env`, keep `DATABASE_URL` as-is, and replace `SESSION_SECRET` with any random 32+ character string.

- [ ] **Step 10: Verify the dev server runs**

Run: `npm run dev &` then after a few seconds `curl -s http://localhost:3000 | grep "信件模板系統"`
Expected: the grep finds a match. Then stop the dev server (`kill %1` or Ctrl+C).

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json next.config.mjs src/app/layout.tsx src/app/page.tsx .env.example .gitignore package-lock.json
git commit -m "chore: scaffold Next.js project (SQLite, no password auth)"
```

---

### Task 2: Prisma Schema, Migration & Synthetic Seed Data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env` (Task 1).
- Produces: Prisma models `User`, `Therapist`, `Template`, `LetterLog` (table names `users`, `therapists`, `templates`, `letters_log`) that every later task's Prisma queries rely on. `User` has no password field. `Template.requiredFields` is a `String` column holding JSON-encoded `string[]` (SQLite has no native array type) — Task 3 provides the encode/decode functions every reader/writer of this column must use.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String      @id @default(uuid())
  name      String
  signature String
  createdAt DateTime    @default(now())
  templates Template[]
  letters   LetterLog[]

  @@map("users")
}

model Therapist {
  id       String  @id @default(uuid())
  name     String
  isActive Boolean @default(true)

  @@map("therapists")
}

model Template {
  id             String      @id @default(uuid())
  category       String
  variant        String
  body           String
  requiredFields String      @default("[]")
  updatedAt      DateTime    @updatedAt
  updatedById    String
  updatedBy      User        @relation(fields: [updatedById], references: [id])
  letters        LetterLog[]

  @@map("templates")
}

model LetterLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  templateId  String
  template    Template @relation(fields: [templateId], references: [id])
  generatedAt DateTime @default(now())

  @@map("letters_log")
}
```

- [ ] **Step 2: Run the initial migration**

Run: `npx prisma migrate dev --name init`
Expected: output ends with "Your database is now in sync with your schema" and creates `prisma/migrations/<timestamp>_init/migration.sql` and `prisma/dev.db`.

- [ ] **Step 3: Write `prisma/seed.ts`** (synthetic data only — no real case/therapist names; every row uses a fixed seed id with `upsert` so re-running the seed never creates duplicates)

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
    create: { id: "seed-therapist-a", name: "測試心理師A" },
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
      category: "媒合信",
      variant: "一般",
      body:
        "親愛的 {{caseRef}} 您好：\n\n" +
        "很高興通知您，已為您媒合心理師 {{therapistName}}，" +
        "首次晤談時間為 {{sessionDate}}。\n\n" +
        '{{#if (eq variant "EAP")}}本次服務由貴公司 EAP 方案支付費用。{{else}}期待與您見面。{{/if}}',
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

Run: `npx prisma db seed` — expected: prints "Seed complete (synthetic data only)."
Run: `npx prisma db seed` again immediately — expected: same message, and no duplicate rows (every row is a fixed-id `upsert`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add Prisma schema (SQLite), migration, and synthetic seed data"
```

---

### Task 3: Required-Fields JSON Codec (TDD)

**Files:**
- Create: `src/lib/letters/requiredFields.ts`
- Create: `src/lib/letters/requiredFields.test.ts`

**Interfaces:**
- Produces: `encodeRequiredFields(fields: string[]): string`, `decodeRequiredFields(json: string): string[]` — Task 7's templates API and Task 9's generate route both consume these to bridge `Template.requiredFields` (a `String` column, per Task 2) and the `string[]` shape the rest of the app (rendering engine, UI) works with.

This exists because SQLite has no native array column type. Per the spec's testing section, this conversion gets its own unit tests since a bug here would silently break the required-field check the whole system exists to enforce.

- [ ] **Step 1: Write the failing test `src/lib/letters/requiredFields.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { encodeRequiredFields, decodeRequiredFields } from "./requiredFields";

describe("requiredFields JSON codec", () => {
  it("round-trips an array of field names through encode then decode", () => {
    const fields = ["caseRef", "therapistName", "sessionDate"];
    expect(decodeRequiredFields(encodeRequiredFields(fields))).toEqual(fields);
  });

  it("encodes an empty array as the literal string '[]'", () => {
    expect(encodeRequiredFields([])).toBe("[]");
  });

  it("decodes '[]' as an empty array", () => {
    expect(decodeRequiredFields("[]")).toEqual([]);
  });

  it("throws a clear error when the stored JSON is not an array", () => {
    expect(() => decodeRequiredFields('{"not":"an array"}')).toThrowError(/預期為陣列/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/requiredFields.test.ts`
Expected: FAIL with "Cannot find module './requiredFields'".

- [ ] **Step 3: Write `src/lib/letters/requiredFields.ts`**

```ts
export function encodeRequiredFields(fields: string[]): string {
  return JSON.stringify(fields);
}

export function decodeRequiredFields(json: string): string[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error(`必填欄位資料格式錯誤，預期為陣列: ${json}`);
  }
  return parsed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/requiredFields.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/requiredFields.ts src/lib/letters/requiredFields.test.ts
git commit -m "feat: add requiredFields JSON codec for SQLite string storage"
```

---

### Task 4: Operator Identity Selection, Session & Middleware

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/auth/select/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/select/page.tsx`
- Create: `src/middleware.ts`

**Interfaces:**
- Produces: `getSession(): Promise<IronSession<SessionData>>`, `sessionOptions`, `SessionData` (`{ userId?, name?, signature? }`) — consumed by Task 7's and Task 9's routes for `session.userId`, and by `src/middleware.ts` below. A session cookie (`framing_session`) that every protected route relies on being present, set by picking a name — **no password, by design** (see Global Constraints).

- [ ] **Step 1: Write `src/lib/auth/session.ts`**

```ts
import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  name?: string;
  signature?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "framing_session",
  cookieOptions: {
    // secure:false is correct for phase 1 (plain http://localhost, no HTTPS).
    // Revisit if the app is ever exposed over HTTPS.
    secure: false,
    httpOnly: true,
    sameSite: "lax",
  },
};

// For Server Components and Route Handlers only (uses next/headers cookies()).
// Middleware must use getIronSession(request, response, sessionOptions) directly — see Step 6.
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
```

- [ ] **Step 2: Write `src/app/api/users/route.ts`** (the fixed name list the identity picker shows)

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(users);
}
```

- [ ] **Step 3: Write `src/app/api/auth/select/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const { userId } = await request.json();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "找不到這個使用者" }, { status: 404 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.signature = user.signature;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Write `src/app/select/page.tsx`**

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
    <main>
      <h1>請選擇目前操作者</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            <button onClick={() => handleSelect(u.id)}>{u.name}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Write `src/middleware.ts`**

Note: Next.js middleware runs before `next/headers` is available, so it must use iron-session's request/response overload of `getIronSession`, not the `getSession()` helper from Step 1. `/api/auth/select` and `/api/users` must stay outside the auth check — the identity picker needs to list users and let you pick one *before* a session exists.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId && request.nextUrl.pathname !== "/select") {
    return NextResponse.redirect(new URL("/select", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/auth/select|api/users|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 7: Manual verification (identity selection end-to-end)**

Run: `npm run dev &`, wait a few seconds, then select the seeded user (id `seed-user-admin` from Task 2's seed):
```bash
curl -i -s -X POST http://localhost:3000/api/auth/select \
  -H "Content-Type: application/json" \
  -d '{"userId":"seed-user-admin"}'
```
Expected: `HTTP/1.1 200 OK`, JSON body `{"ok":true}`, and a `Set-Cookie: framing_session=...` header present.

Then verify the redirect works for anonymous requests:
```bash
curl -i -s http://localhost:3000/templates
```
Expected: a redirect response (`307`/`308`) with `Location: http://localhost:3000/select`.

Stop the dev server (`kill %1`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/session.ts src/app/api/users/route.ts src/app/api/auth/select/route.ts src/app/api/auth/logout/route.ts src/app/select/page.tsx src/middleware.ts
git commit -m "feat: add operator identity selection, session, and middleware (no password)"
```

---

### Task 5: Letter Rendering Engine (TDD)

**Files:**
- Create: `src/lib/letters/render.ts`
- Create: `src/lib/letters/render.test.ts`

**Interfaces:**
- Produces: `renderLetter(input: RenderInput): string`, `MissingFieldsError` (with `.missingFields: string[]`), `RenderInput` type — Task 9's generate route consumes all three. `RenderInput.requiredFields` is a plain `string[]` — the caller (Task 9) is responsible for decoding it from storage via Task 3's `decodeRequiredFields` before calling this function; this module has no knowledge of how the field list was stored.

This is the highest-priority tested logic in the spec (placeholder/variant substitution is the reason this system exists).

- [ ] **Step 1: Write the failing test `src/lib/letters/render.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { renderLetter, MissingFieldsError } from "./render";

describe("renderLetter", () => {
  const templateBody =
    "親愛的 {{caseRef}}：心理師為 {{therapistName}}。" +
    '{{#if (eq variant "EAP")}}本次由 EAP 支付。{{else}}請自費。{{/if}}';

  it("substitutes fields and picks the matching variant block", () => {
    const result = renderLetter({
      templateBody,
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
      variant: "EAP",
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。本次由 EAP 支付。");
  });

  it("falls back to the shared block for a non-matching variant", () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/render.test.ts`
Expected: FAIL with "Cannot find module './render'".

- [ ] **Step 3: Write `src/lib/letters/render.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/render.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/letters/render.ts src/lib/letters/render.test.ts
git commit -m "feat: add letter rendering engine with variant conditionals"
```

---

### Task 6: Therapists List API

**Files:**
- Create: `src/app/api/therapists/route.ts`

**Interfaces:**
- Produces: `GET /api/therapists` returning `{ id: string; name: string; isActive: boolean }[]` — Task 9's generate page consumes this for the therapist dropdown.

- [ ] **Step 1: Write `src/app/api/therapists/route.ts`**

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const therapists = await prisma.therapist.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(therapists);
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev &`, wait a few seconds, then select the seeded operator identity and call the endpoint with the session cookie:
```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/select \
  -H "Content-Type: application/json" \
  -d '{"userId":"seed-user-admin"}' > /dev/null
curl -s -b cookies.txt http://localhost:3000/api/therapists
```
Expected: a JSON array containing `"測試心理師A"` and `"測試心理師B"`.

Stop the dev server (`kill %1`) and delete `cookies.txt`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/therapists/route.ts
git commit -m "feat: add therapists list API"
```

---

### Task 7: Templates CRUD API with Undeclared-Field Warning

**Files:**
- Create: `src/lib/letters/templateFields.ts`
- Create: `src/lib/letters/templateFields.test.ts`
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[id]/route.ts`

**Interfaces:**
- Consumes: `getSession` (Task 4); `encodeRequiredFields`, `decodeRequiredFields` (Task 3).
- Produces: `findUndeclaredFields(body: string, requiredFields: string[]): string[]` (this task's own routes consume it); `GET/POST /api/templates`, `PUT /api/templates/:id` — Task 8's UI and Task 9's generate route consume these. **Every response from these routes carries `requiredFields` as a decoded `string[]`** (never the raw JSON-string column) — Task 8/9 never touch the codec directly, only this task's routes do.

The spec requires: "模板內文引用了未定義的欄位 → 儲存模板時提示編輯者". This is implemented as a non-blocking warning (not a hard error), since a template author may legitimately reference the fields always available to every letter (`caseRef`, `therapistName`, `sessionDate`, `variant`) without declaring them in `requiredFields`.

- [ ] **Step 1: Write the failing test `src/lib/letters/templateFields.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { findUndeclaredFields } from "./templateFields";

describe("findUndeclaredFields", () => {
  it("returns an empty list when every referenced field is declared or standard", () => {
    const body = "{{caseRef}} {{therapistName}} {{sessionDate}}";
    expect(findUndeclaredFields(body, [])).toEqual([]);
  });

  it("flags a field that is neither standard nor in requiredFields", () => {
    const body = "{{caseRef}} {{groupName}}";
    expect(findUndeclaredFields(body, [])).toEqual(["groupName"]);
  });

  it("does not flag a field once it is declared in requiredFields", () => {
    const body = "{{caseRef}} {{groupName}}";
    expect(findUndeclaredFields(body, ["groupName"])).toEqual([]);
  });

  it("ignores Handlebars block helpers like #if/else/variant", () => {
    const body = '{{#if (eq variant "EAP")}}{{caseRef}}{{else}}{{caseRef}}{{/if}}';
    expect(findUndeclaredFields(body, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/templateFields.test.ts`
Expected: FAIL with "Cannot find module './templateFields'".

- [ ] **Step 3: Write `src/lib/letters/templateFields.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/templateFields.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write `src/app/api/templates/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return { ...template, requiredFields: decodeRequiredFields(template.requiredFields) };
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

  const { category, variant, body, requiredFields } = await request.json();
  if (!category || !variant || !body) {
    return NextResponse.json({ error: "類別、方案變體、內文為必填" }, { status: 400 });
  }

  const declaredFields: string[] = requiredFields ?? [];
  const template = await prisma.template.create({
    data: {
      category,
      variant,
      body,
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(body, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields }, { status: 201 });
}
```

- [ ] **Step 6: Write `src/app/api/templates/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, type Template } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

function serializeTemplate(template: Template) {
  return { ...template, requiredFields: decodeRequiredFields(template.requiredFields) };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { id } = await params;
  const { category, variant, body, requiredFields } = await request.json();
  const declaredFields: string[] = requiredFields ?? [];

  const template = await prisma.template.update({
    where: { id },
    data: {
      category,
      variant,
      body,
      requiredFields: encodeRequiredFields(declaredFields),
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(body, declaredFields);
  return NextResponse.json({ template: serializeTemplate(template), undeclaredFields });
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev &`, wait a few seconds:
```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/select \
  -H "Content-Type: application/json" \
  -d '{"userId":"seed-user-admin"}' > /dev/null
curl -s -b cookies.txt -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{"category":"準備信","variant":"青壯","body":"{{caseRef}} {{groupName}}","requiredFields":["caseRef"]}'
```
Expected: HTTP 201, JSON containing `"category":"準備信"`, `"requiredFields":["caseRef"]` (a decoded array, not a raw JSON string), and `"undeclaredFields":["groupName"]`.

Stop the dev server (`kill %1`) and delete `cookies.txt`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/letters/templateFields.ts src/lib/letters/templateFields.test.ts src/app/api/templates
git commit -m "feat: add templates CRUD API with undeclared-field warning"
```

---

### Task 8: Template Editor UI

**Files:**
- Create: `src/app/templates/page.tsx`

**Interfaces:**
- Consumes: `GET/POST/PUT /api/templates` from Task 7 (response shape `{ template, undeclaredFields }` on POST/PUT; `requiredFields` always a decoded `string[]` per Task 7's `serializeTemplate`). This UI never encodes/decodes JSON itself — that's entirely Task 7's responsibility.

- [ ] **Step 1: Write `src/app/templates/page.tsx`**

Note: the create/edit form includes a "必填欄位" input so the template author explicitly declares which placeholders block letter generation until filled (per spec: without this, every self-service template would silently get `requiredFields: []`, defeating the point of the missing-field check in Task 5/Task 9). The list also has an 編輯 button per template so existing bodies can be updated in place (spec "模板編輯" step 3: "可編輯既有模板內文").

```tsx
"use client";

import { useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  category: string;
  variant: string;
  body: string;
  requiredFields: string[];
}

interface FormState {
  category: string;
  variant: string;
  body: string;
  requiredFieldsText: string;
}

const EMPTY_FORM: FormState = { category: "", variant: "一般", body: "", requiredFieldsText: "" };

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
      variant: t.variant,
      body: t.body,
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
    const requiredFields = form.requiredFieldsText
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, variant: form.variant, body: form.body, requiredFields }),
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
            {t.category}（{t.variant}）
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
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
        </label>
        <label>
          方案變體
          <select value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })}>
            <option value="一般">一般</option>
            <option value="青壯">青壯</option>
            <option value="北捷">北捷</option>
            <option value="EAP">EAP</option>
            <option value="不適用">不適用</option>
          </select>
        </label>
        <label>
          內文
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
            rows={10}
          />
        </label>
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
        <p role="alert">
          注意：內文引用了未宣告的欄位（{warning.join("、")}），請確認拼字是否正確。
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev &`, wait a few seconds. In a browser, open `http://localhost:3000/select` and pick "測試人員", then open `http://localhost:3000/templates`. Confirm the seeded "媒合信（一般）" appears in the list.

Add a new template: 類別 `候補信`, 方案變體 `一般`, 內文 containing `{{caseRef}} {{groupName}}`, 必填欄位 `caseRef, groupName`. Confirm no warning appears (both fields declared) and the new template appears in the list.

Click 編輯 on that new template, add `{{oopsField}}` to the body, and save. Confirm the warning message appears listing `oopsField`.

Reload the page and confirm the edited body persisted (not lost).

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/templates/page.tsx
git commit -m "feat: add self-service template editor UI"
```

---

### Task 9: Letter Generation UI, Gmail Draft Prefill & Audit Log

**Files:**
- Create: `src/lib/letters/gmailUrl.ts`
- Create: `src/lib/letters/gmailUrl.test.ts`
- Create: `src/app/api/letters/generate/route.ts`
- Create: `src/app/generate/page.tsx`

**Interfaces:**
- Consumes: `renderLetter`, `MissingFieldsError` (Task 5); `getSession` (Task 4); `decodeRequiredFields` (Task 3); `GET /api/templates`, `GET /api/therapists` (Tasks 6–7).
- Produces: `buildGmailComposeUrl(input: GmailDraftInput): string`; `POST /api/letters/generate` returning `{ renderedBody: string }` on success or `{ error, missingFields }` (400) on validation failure.

- [ ] **Step 1: Write the failing test `src/lib/letters/gmailUrl.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildGmailComposeUrl } from "./gmailUrl";

describe("buildGmailComposeUrl", () => {
  it("round-trips recipient, subject, and multi-line body through the URL unchanged", () => {
    const url = buildGmailComposeUrl({
      to: "case@example.com",
      subject: "媒合通知",
      body: "第一行\n第二行",
    });

    expect(url.startsWith("https://mail.google.com/mail/?")).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get("view")).toBe("cm");
    expect(params.get("fs")).toBe("1");
    expect(params.get("to")).toBe("case@example.com");
    expect(params.get("su")).toBe("媒合通知");
    expect(params.get("body")).toBe("第一行\n第二行");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/letters/gmailUrl.test.ts`
Expected: FAIL with "Cannot find module './gmailUrl'".

- [ ] **Step 3: Write `src/lib/letters/gmailUrl.ts`**

```ts
export interface GmailDraftInput {
  to: string;
  subject: string;
  body: string;
}

export function buildGmailComposeUrl(input: GmailDraftInput): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: input.to,
    su: input.subject,
    body: input.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/letters/gmailUrl.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write `src/app/api/letters/generate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { renderLetter, MissingFieldsError } from "@/lib/letters/render";
import { decodeRequiredFields } from "@/lib/letters/requiredFields";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "尚未選擇操作者" }, { status: 401 });
  }

  const { templateId, fields, variant } = await request.json();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) {
    return NextResponse.json({ error: "找不到模板" }, { status: 404 });
  }

  let renderedBody: string;
  try {
    renderedBody = renderLetter({
      templateBody: template.body,
      requiredFields: decodeRequiredFields(template.requiredFields),
      fields,
      variant,
    });
  } catch (err) {
    if (err instanceof MissingFieldsError) {
      return NextResponse.json({ error: err.message, missingFields: err.missingFields }, { status: 400 });
    }
    throw err;
  }

  // Audit log intentionally excludes caseRef, recipient email, and the rendered body itself.
  await prisma.letterLog.create({
    data: { userId: session.userId, templateId: template.id },
  });

  return NextResponse.json({ renderedBody });
}
```

- [ ] **Step 6: Write `src/app/generate/page.tsx`**

Note: the field inputs are generated dynamically from `template.requiredFields` (already a decoded `string[]` from Task 7's API — this page never touches JSON encoding), not hardcoded to `caseRef`/`therapistName`/`sessionDate`. A self-service template can declare any required field name (e.g. `groupName` for the 候補信 template added in Task 8's verification step); hardcoding the three known fields would leave no way to fill in anything else, silently breaking every template beyond the seeded one. `therapistName` and `sessionDate` get a dropdown/date-picker widget when they appear; any other field name falls back to a plain text input labeled with its raw name.

```tsx
"use client";

import { useEffect, useState } from "react";
import { buildGmailComposeUrl } from "@/lib/letters/gmailUrl";

interface TemplateItem {
  id: string;
  category: string;
  variant: string;
  requiredFields: string[];
}

interface Therapist {
  id: string;
  name: string;
}

export default function GeneratePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [recipientEmail, setRecipientEmail] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/therapists").then((r) => r.json()).then(setTherapists);
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    setFields({});
    setResult("");
  }

  function setField(name: string, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedTemplate) return;

    const res = await fetch("/api/letters/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        variant: selectedTemplate.variant,
        fields,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResult(data.renderedBody);
  }

  function openGmailDraft() {
    const url = buildGmailComposeUrl({
      to: recipientEmail,
      subject: selectedTemplate?.category ?? "",
      body: result,
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
                {t.category}（{t.variant}）
              </option>
            ))}
          </select>
        </label>

        {selectedTemplate?.requiredFields.map((fieldName) => {
          if (fieldName === "therapistName") {
            return (
              <label key={fieldName}>
                心理師
                <select
                  value={fields.therapistName ?? ""}
                  onChange={(e) => setField("therapistName", e.target.value)}
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
              <label key={fieldName}>
                日期
                <input
                  type="date"
                  value={fields.sessionDate ?? ""}
                  onChange={(e) => setField("sessionDate", e.target.value)}
                  required
                />
              </label>
            );
          }
          if (fieldName === "caseRef") {
            return (
              <label key={fieldName}>
                個案代號
                <input
                  value={fields.caseRef ?? ""}
                  onChange={(e) => setField("caseRef", e.target.value)}
                  required
                />
              </label>
            );
          }
          return (
            <label key={fieldName}>
              {fieldName}
              <input
                value={fields[fieldName] ?? ""}
                onChange={(e) => setField(fieldName, e.target.value)}
                required
              />
            </label>
          );
        })}

        <label>
          收件者 Email（僅本次使用，不會被儲存）
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={!templateId}>
          產生信件
        </button>
      </form>
      {result && (
        <section>
          <h2>產出結果</h2>
          <pre>{result}</pre>
          <button onClick={openGmailDraft}>開啟 Gmail 草稿</button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Manual end-to-end verification**

Run: `npm run dev &`, wait a few seconds. In a browser: open `/select` and pick "測試人員", open `http://localhost:3000/generate`, select the seeded "媒合信（一般）" template. Confirm the 心理師 dropdown, 日期 picker, and 個案代號 text box all appear (from `requiredFields`), pick a therapist, pick a date, type a case reference (e.g. `A001`) and a recipient email (e.g. `test@example.com`), click 產生信件. Confirm the rendered text shows the substituted values and the "一般" (non-EAP) branch text. Click 開啟 Gmail 草稿 and confirm a new tab opens to `mail.google.com` with the compose window pre-filled.

Then select the "候補信（一般）" template added during Task 8's verification (`requiredFields: caseRef, groupName`). Confirm the form now shows a 個案代號 box and a plain `groupName` text box (not a 心理師 dropdown or date picker, since that template didn't declare those fields), fill both in, and confirm generation succeeds.

Then confirm the audit log wrote a row without any case data:
```bash
npx prisma studio
```
Open the `letters_log` table in the browser UI it launches and confirm a new row exists with only `userId`, `templateId`, and `generatedAt` populated — no case reference or letter body column exists on that table at all, by design.

Stop the dev server and Prisma Studio.

- [ ] **Step 8: Commit**

```bash
git add src/lib/letters/gmailUrl.ts src/lib/letters/gmailUrl.test.ts src/app/api/letters src/app/generate
git commit -m "feat: add letter generation UI with Gmail draft prefill and audit log"
```

---

### Task 10: Windows Deployment Instructions

**Files:**
- Create: `docs/WINDOWS_SETUP.md`
- Create: `scripts/backup-db.bat`

**Interfaces:**
- None (documentation only). References env var names from Task 1 (`.env.example`) and seed data from Task 2 (`prisma/seed.ts`) — must stay in sync if either changes later. Implements the spec's SQLite-file-copy backup commitment, which no earlier task covers.

- [ ] **Step 1: Write `docs/WINDOWS_SETUP.md`**

```markdown
# Windows 主機安裝與啟動說明

本文件是第一階段（信件模板系統）在機構 Windows 主機上的安裝步驟。目標主機：8GB RAM、Intel i5-12400。只需要本機使用，不對外或對區網開放連線。

## 一次性安裝

1. 安裝 Node.js LTS：至 https://nodejs.org 下載 Windows 安裝程式（.msi），一路下一步完成即可。
2. 取得本專案程式碼，放到主機上的一個資料夾（例如 `C:\framing`）。
3. 在該資料夾開啟命令提示字元（cmd），執行：
   ```
   npm install
   ```
4. 複製 `.env.example` 為 `.env`。`DATABASE_URL` 不需要修改（資料庫是單一檔案，會自動建立在專案資料夾內的 `prisma` 子目錄中），只需要把 `SESSION_SECRET` 換成自己想的隨機英數字串（至少 32 字元）。
5. 建立資料表：
   ```
   npx prisma migrate deploy
   ```
6. （可選）若要先用測試資料驗證系統可用，執行：
   ```
   npx prisma db seed
   ```
   會建立一位測試操作者「測試人員」與兩位測試心理師 —— **正式使用前請自行在系統裡新增真實的操作者名單。**

## 每次要使用時

在該資料夾開啟命令提示字元，執行：
```
npm run build
npm start
```
接著開啟瀏覽器，輸入 `http://localhost:3000` 即可使用。不使用時可以直接關閉命令提示字元視窗結束程式。

## 資料庫備份設定

資料庫是單一檔案（`prisma\dev.db`），備份就是複製這個檔案，不需要額外的匯出工具。

**一次性設定：**

1. 開啟「工作排程器」（Task Scheduler，開始選單搜尋即可找到）→ 建立基本工作。
2. 名稱填 `framing 資料庫備份`，觸發程序選「每天」，時間選一個深夜、電腦通常還開著的時段（例如 23:30）。
3. 動作選「啟動程式」，程式路徑填 `scripts\backup-db.bat` 的完整路徑（例如 `C:\framing\scripts\backup-db.bat`）。
4. 完成後在工作排程器裡對這個工作按右鍵「執行」，確認 `C:\framing\backups\` 資料夾內出現一個新的 `.db` 檔案。

**每週人工作業：**

- 定期（建議每週）將 `backups` 資料夾內最新的備份檔複製到外接硬碟，並將硬碟異地存放（例如帶回家、保險箱），避免主機單一硬體故障造成資料全失。
- 外接硬碟上的舊檔案可視空間酌量刪除，只需保留近期幾份。

## 目前刻意不做的事

- 沒有設定成開機自動啟動的背景服務（Windows 服務），需要每次手動執行上面的啟動指令
- 沒有對外或對區域網路開放，其他電腦無法連線
- 沒有 HTTPS
- 沒有密碼驗證（操作者是用選的，不是登入——見設計文件的取捨說明）

這些都是本階段刻意的取捨（見 `docs/superpowers/specs/2026-07-16-letter-templates-design.md`），如果之後要讓其他人連線使用，需要回頭處理。
```

- [ ] **Step 2: Write `scripts/backup-db.bat`**

Note: the source path assumes Prisma's default SQLite file location for this project — `prisma\dev.db`, relative to the repo root (see Task 1 Step 6's note on why the file ends up under `prisma/` rather than the project root).

```bat
@echo off
setlocal
set BACKUP_DIR=%~dp0..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%
copy "%~dp0..\prisma\dev.db" "%BACKUP_DIR%\framing_%TIMESTAMP%.db"
```

- [ ] **Step 3: Verify consistency**

Re-read `.env.example` (Task 1) and `prisma/seed.ts` (Task 2), confirm the env var names and seed data quoted in `docs/WINDOWS_SETUP.md` match exactly. Confirm `scripts/backup-db.bat`'s source path (`prisma\dev.db`) matches where Task 2's migration actually creates the SQLite file.

- [ ] **Step 4: Commit**

```bash
git add docs/WINDOWS_SETUP.md scripts/backup-db.bat
git commit -m "docs: add Windows deployment instructions and SQLite backup script"
```
