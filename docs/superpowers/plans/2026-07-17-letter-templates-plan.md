# 信件模板系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-1 letter-template system per `docs/superpowers/specs/2026-07-16-letter-templates-design.md` — self-service template CRUD, letter generation with placeholder/variant substitution, Gmail draft prefill, and a minimal audit log.

**Architecture:** Next.js (TypeScript, App Router) single project serving both UI and API routes; PostgreSQL via Prisma ORM; session-based auth (iron-session, no third-party identity provider); Handlebars-based rendering engine for templates.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Prisma 6, PostgreSQL, bcryptjs, iron-session, handlebars, Vitest.

## Global Constraints

- Never write real case data anywhere in this repo or in prompts to any AI model — all seed/test data must be synthetic (per spec "隱私與資料處理備註" and project-wide hard rule).
- Frontend is TypeScript; backend must not be PHP (satisfied by Next.js/Node).
- Production target is a shared Windows PC (8GB RAM, i5-12400) — avoid dependencies that require native compilation (Visual Studio build tools), so use `bcryptjs` (pure JS), never `bcrypt`.
- Phase 1 has no HTTPS, no domain, no LAN/public network exposure — `localhost` only.
- Self-service template add/edit must work from the UI with no code deploy required (non-negotiable per spec).
- Recipient email is entered per-use and must never be persisted to the database or the audit log.
- `letters_log` (audit log) records only who/when/which template — never the case reference or rendered letter body.
- Login failures must return a generic error (no account-enumeration signal).

---

### Task 1: Project Scaffold & Local Dev Database

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `.env.example`
- Create: `docker-compose.dev.yml`
- Modify: `.gitignore` (add `.env`, `.next/`)

**Interfaces:**
- Produces: a running Next.js dev server at `http://localhost:3000`, a `DATABASE_URL` env convention every later task's Prisma client relies on.

- [ ] **Step 1: Write `package.json`**

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
    "bcryptjs": "^2.4.3",
    "iron-session": "^8.0.0",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
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

```
DATABASE_URL="postgresql://framing:framing_dev_password@localhost:5432/framing?schema=public"
SESSION_SECRET="change-this-to-a-random-32-character-minimum-string"
```

- [ ] **Step 7: Write `docker-compose.dev.yml`** (local dev convenience only — production on the clinic's Windows machine uses a native PostgreSQL install per `docs/WINDOWS_SETUP.md`, written in Task 10; this file is not used there)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: framing
      POSTGRES_PASSWORD: framing_dev_password
      POSTGRES_DB: framing
    ports:
      - "5432:5432"
    volumes:
      - framing_pg_data:/var/lib/postgresql/data

volumes:
  framing_pg_data:
```

- [ ] **Step 8: Update `.gitignore`**

Add these lines if not already present:
```
.env
.next/
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes with no error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 10: Start local dev Postgres and create `.env`**

Run: `docker compose -f docker-compose.dev.yml up -d`
Expected: container starts, `docker compose -f docker-compose.dev.yml ps` shows it healthy/running.

Then copy `.env.example` to `.env` (values already match the compose file's credentials), and replace `SESSION_SECRET` with any random 32+ character string.

- [ ] **Step 11: Verify the dev server runs**

Run: `npm run dev &` then after a few seconds `curl -s http://localhost:3000 | grep "信件模板系統"`
Expected: the grep finds a match. Then stop the dev server (`kill %1` or Ctrl+C).

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json next.config.mjs src/app/layout.tsx src/app/page.tsx .env.example docker-compose.dev.yml .gitignore package-lock.json
git commit -m "chore: scaffold Next.js project and local dev database"
```

---

### Task 2: Prisma Schema, Migration & Synthetic Seed Data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env` (Task 1).
- Produces: Prisma models `User`, `Therapist`, `Template`, `LetterLog` (table names `users`, `therapists`, `templates`, `letters_log`) that every later task's Prisma queries rely on. `Template.requiredFields` is `string[]`.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String      @id @default(uuid())
  email        String      @unique
  passwordHash String
  signature    String
  createdAt    DateTime    @default(now())
  templates    Template[]
  letters      LetterLog[]

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
  requiredFields String[]    @default([])
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
Expected: output ends with "Your database is now in sync with your schema" and creates `prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 3: Write `prisma/seed.ts`** (synthetic data only — no real case/therapist names)

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("test-password-123", 10);

  const user = await prisma.user.upsert({
    where: { email: "test.admin@example.com" },
    update: {},
    create: {
      email: "test.admin@example.com",
      passwordHash,
      signature: "TA",
    },
  });

  await prisma.therapist.createMany({
    data: [{ name: "測試心理師A" }, { name: "測試心理師B" }],
    skipDuplicates: true,
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
      requiredFields: ["caseRef", "therapistName", "sessionDate"],
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

- [ ] **Step 4: Run the seed**

Run: `npx prisma db seed`
Expected: prints "Seed complete (synthetic data only)."

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add Prisma schema, migration, and synthetic seed data"
```

---

### Task 3: Password Hashing & Credential-Check Logic (TDD)

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/password.test.ts`
- Create: `src/lib/auth/session.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`, `checkCredentials(user: { passwordHash: string } | null, password: string): Promise<boolean>` — Task 4's login route consumes `checkCredentials`. `getSession(): Promise<IronSession<SessionData>>` and `sessionOptions`/`SessionData` — Task 4's login/logout routes and Task 9's generate route consume `getSession`; Task 4's middleware consumes `sessionOptions`/`SessionData` directly (not `getSession`, see Task 4 note).

- [ ] **Step 1: Write the failing test `src/lib/auth/password.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, checkCredentials } from "./password";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("never stores the password in plain text", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
  });
});

describe("checkCredentials (allowlist login check)", () => {
  it("accepts a matching password for a known user", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await checkCredentials({ passwordHash: hash }, "correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong password for a known user", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await checkCredentials({ passwordHash: hash }, "wrong")).toBe(false);
  });

  it("rejects when there is no matching user at all (not on the allowlist)", async () => {
    expect(await checkCredentials(null, "anything")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/password.test.ts`
Expected: FAIL with "Cannot find module './password'" (file doesn't exist yet).

- [ ] **Step 3: Write `src/lib/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function checkCredentials(
  user: { passwordHash: string } | null,
  password: string
): Promise<boolean> {
  if (!user) return false;
  return verifyPassword(password, user.passwordHash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/password.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write `src/lib/auth/session.ts`**

```ts
import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  email?: string;
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
// Middleware must use getIronSession(request, response, sessionOptions) directly — see Task 4.
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/password.ts src/lib/auth/password.test.ts src/lib/auth/session.ts
git commit -m "feat: add password hashing, credential check, and session helpers"
```

---

### Task 4: Login/Logout Routes, Login Page & Auth Middleware

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `checkCredentials`, `getSession`, `sessionOptions`, `SessionData` from Task 3.
- Produces: an authenticated session cookie (`framing_session`) that every protected route (Tasks 6–9) relies on being present.

- [ ] **Step 1: Write `src/app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { checkCredentials } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user = await prisma.user.findUnique({ where: { email } });
  const isValid = await checkCredentials(user, password);

  if (!isValid || !user) {
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.signature = user.signature;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write `src/app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError("帳號或密碼錯誤");
      return;
    }
    router.push("/");
  }

  return (
    <main>
      <h1>登入</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          密碼
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">登入</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Write `src/middleware.ts`**

Note: Next.js middleware runs before `next/headers` is available, so it must use iron-session's request/response overload of `getIronSession`, not the `getSession()` helper from Task 3 (that one is for Server Components/Route Handlers only).

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/auth/login|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Manual verification (login flow end-to-end)**

Run: `npm run dev &`, wait a few seconds, then:
```bash
curl -i -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test.admin@example.com","password":"test-password-123"}'
```
Expected: `HTTP/1.1 200 OK`, JSON body `{"ok":true}`, and a `Set-Cookie: framing_session=...` header present.

Then verify the redirect works for anonymous requests:
```bash
curl -i -s http://localhost:3000/templates
```
Expected: a redirect response (`307`/`308`) with `Location: http://localhost:3000/login`.

Stop the dev server (`kill %1`).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts src/app/login/page.tsx src/middleware.ts
git commit -m "feat: add login/logout routes, login page, and auth middleware"
```

---

### Task 5: Letter Rendering Engine (TDD)

**Files:**
- Create: `src/lib/letters/render.ts`
- Create: `src/lib/letters/render.test.ts`

**Interfaces:**
- Produces: `renderLetter(input: RenderInput): string`, `MissingFieldsError` (with `.missingFields: string[]`), `RenderInput` type — Task 9's generate route consumes all three.

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

Run: `npm run dev &`, wait a few seconds, then log in and call the endpoint with the session cookie:
```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test.admin@example.com","password":"test-password-123"}' > /dev/null
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
- Consumes: `getSession` from Task 3.
- Produces: `findUndeclaredFields(body: string, requiredFields: string[]): string[]` (Task 8's UI consumes the warning surfaced by the API); `GET/POST /api/templates`, `PUT /api/templates/:id` — Task 8's UI and Task 9's generate route consume these.

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
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";

const prisma = new PrismaClient();

export async function GET() {
  const templates = await prisma.template.findMany({ orderBy: { category: "asc" } });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
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
      requiredFields: declaredFields,
      updatedById: session.userId,
    },
  });

  const undeclaredFields = findUndeclaredFields(body, declaredFields);
  return NextResponse.json({ template, undeclaredFields }, { status: 201 });
}
```

- [ ] **Step 6: Write `src/app/api/templates/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { findUndeclaredFields } from "@/lib/letters/templateFields";

const prisma = new PrismaClient();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const { category, variant, body, requiredFields } = await request.json();
  const declaredFields: string[] = requiredFields ?? [];

  const template = await prisma.template.update({
    where: { id },
    data: { category, variant, body, requiredFields: declaredFields, updatedById: session.userId },
  });

  const undeclaredFields = findUndeclaredFields(body, declaredFields);
  return NextResponse.json({ template, undeclaredFields });
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev &`, wait a few seconds:
```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test.admin@example.com","password":"test-password-123"}' > /dev/null
curl -s -b cookies.txt -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{"category":"準備信","variant":"青壯","body":"{{caseRef}} {{groupName}}","requiredFields":["caseRef"]}'
```
Expected: HTTP 201, JSON containing `"category":"準備信"` and `"undeclaredFields":["groupName"]`.

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
- Consumes: `GET/POST/PUT /api/templates` from Task 7 (response shape `{ template, undeclaredFields }` on POST/PUT).

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

Run: `npm run dev &`, wait a few seconds. In a browser, log in at `http://localhost:3000/login` with `test.admin@example.com` / `test-password-123`, then open `http://localhost:3000/templates`. Confirm the seeded "媒合信（一般）" appears in the list.

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
- Consumes: `renderLetter`, `MissingFieldsError` (Task 5); `getSession` (Task 3); `GET /api/templates`, `GET /api/therapists` (Tasks 6–7).
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

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
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
      requiredFields: template.requiredFields,
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

Note: the field inputs are generated dynamically from `template.requiredFields`, not hardcoded to `caseRef`/`therapistName`/`sessionDate`. A self-service template can declare any required field name (e.g. `groupName` for the 候補信 template added in Task 8's verification step); hardcoding the three known fields would leave no way to fill in anything else, silently breaking every template beyond the seeded one. `therapistName` and `sessionDate` get a dropdown/date-picker widget when they appear; any other field name falls back to a plain text input labeled with its raw name.

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

Run: `npm run dev &`, wait a few seconds. In a browser: log in, open `http://localhost:3000/generate`, select the seeded "媒合信（一般）" template. Confirm the 心理師 dropdown, 日期 picker, and 個案代號 text box all appear (from `requiredFields`), pick a therapist, pick a date, type a case reference (e.g. `A001`) and a recipient email (e.g. `test@example.com`), click 產生信件. Confirm the rendered text shows the substituted values and the "一般" (non-EAP) branch text. Click 開啟 Gmail 草稿 and confirm a new tab opens to `mail.google.com` with the compose window pre-filled.

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
- None (documentation only). References env var names from Task 1 (`.env.example`) and seed credentials from Task 2 (`prisma/seed.ts`) — must stay in sync if either changes later. Also implements the spec's "備份：每晚 pg_dump 至本機，再由人工定期複製到外接硬碟" commitment, which no earlier task covers.

- [ ] **Step 1: Write `docs/WINDOWS_SETUP.md`**

```markdown
# Windows 主機安裝與啟動說明

本文件是第一階段（信件模板系統）在機構 Windows 主機上的安裝步驟。目標主機：8GB RAM、Intel i5-12400。只需要本機使用，不對外或對區網開放連線。

## 一次性安裝

1. 安裝 Node.js LTS：至 https://nodejs.org 下載 Windows 安裝程式（.msi），一路下一步完成即可。
2. 安裝 PostgreSQL for Windows：至 https://www.postgresql.org/download/windows/ 下載安裝程式，安裝時記下你設定的 postgres 密碼。安裝完成後用內附的 pgAdmin 或命令列建立一個資料庫，例如命名為 `framing`。
3. 取得本專案程式碼，放到主機上的一個資料夾。
4. 在該資料夾開啟命令提示字元（cmd），執行：
   ```
   npm install
   ```
5. 複製 `.env.example` 為 `.env`，把 `DATABASE_URL` 改成你在步驟 2 設定的帳密與資料庫名稱，例如：
   ```
   DATABASE_URL="postgresql://postgres:你的密碼@localhost:5432/framing?schema=public"
   SESSION_SECRET="換成一組自己想的隨機英數字串，至少32字元"
   ```
6. 建立資料表：
   ```
   npx prisma migrate deploy
   ```
7. （可選）若要先用測試帳號驗證系統可用，執行：
   ```
   npx prisma db seed
   ```
   測試帳號：test.admin@example.com / test-password-123 —— **正式使用前請自行建立真實帳號並移除或停用此測試帳號**。

## 每次要使用時

在該資料夾開啟命令提示字元，執行：
```
npm run build
npm start
```
接著開啟瀏覽器，輸入 `http://localhost:3000` 即可使用。不使用時可以直接關閉命令提示字元視窗結束程式。

## 資料庫備份設定

**一次性設定：**

1. 用記事本開啟 `scripts\backup-db.bat`，把 `YOUR_POSTGRES_PASSWORD_HERE` 換成你在「一次性安裝」步驟 2 設定的 postgres 密碼，存檔。
2. 開啟「工作排程器」（Task Scheduler，開始選單搜尋即可找到）→ 建立基本工作。
3. 名稱填 `framing 資料庫備份`，觸發程序選「每天」，時間選一個深夜、電腦通常還開著的時段（例如 23:30）。
4. 動作選「啟動程式」，程式路徑填該 `.bat` 檔的完整路徑（例如 `C:\framing\scripts\backup-db.bat`）。
5. 完成後在工作排程器裡對這個工作按右鍵「執行」，確認 `C:\framing\backups\` 資料夾內出現一個新的 `.dump` 檔案。

**每週人工作業：**

- 定期（建議每週）將 `backups` 資料夾內最新的備份檔複製到外接硬碟，並將硬碟異地存放（例如帶回家、保險箱），避免主機單一硬體故障造成資料全失。
- 外接硬碟上的舊檔案可視空間酌量刪除，只需保留近期幾份。

## 目前刻意不做的事

- 沒有設定成開機自動啟動的背景服務（Windows 服務），需要每次手動執行上面的啟動指令
- 沒有對外或對區域網路開放，其他電腦無法連線
- 沒有 HTTPS

這些都是本階段刻意的取捨（見 `docs/superpowers/specs/2026-07-16-letter-templates-design.md`），如果之後要讓其他人連線使用，需要回頭處理。
```

- [ ] **Step 2: Write `scripts/backup-db.bat`**

Note: `pg_dump.exe`'s path assumes the default PostgreSQL 16 Windows install location; if the installer used a different version/path, the admin following `docs/WINDOWS_SETUP.md` needs to adjust this one line. The password placeholder is filled in directly by the admin during one-time setup (see `docs/WINDOWS_SETUP.md`'s 資料庫備份設定 step 1) rather than via an OS environment variable, consistent with how `.env` is already hand-edited elsewhere in this doc.

```bat
@echo off
setlocal
set BACKUP_DIR=%~dp0..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%
set PGPASSWORD=YOUR_POSTGRES_PASSWORD_HERE
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -F c -f "%BACKUP_DIR%\framing_%TIMESTAMP%.dump" framing
```

- [ ] **Step 3: Verify consistency**

Re-read `.env.example` (Task 1) and `prisma/seed.ts` (Task 2), confirm the env var names and seed credentials quoted in `docs/WINDOWS_SETUP.md` match exactly. Confirm `scripts/backup-db.bat`'s database name (`framing`) matches the one used in `docs/WINDOWS_SETUP.md`'s installation steps.

- [ ] **Step 4: Commit**

```bash
git add docs/WINDOWS_SETUP.md scripts/backup-db.bat
git commit -m "docs: add Windows deployment instructions and nightly backup script"
```
