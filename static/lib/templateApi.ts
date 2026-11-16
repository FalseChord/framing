import { findUndeclaredFields } from "../../src/lib/letters/templateFields";
import { encodeRequiredFields, decodeRequiredFields } from "../../src/lib/letters/requiredFields";

// The Worker's /api/templates endpoints. Same request/response contract as the
// full app's src/app/api/templates routes, so src/components/TemplateManager.tsx
// works unchanged against either backend.

export interface TemplateRecord {
  id: string;
  category: string;
  variantLabel: string;
  subject: string;
  body: string;
  requiredFields: string[];
  optionalFields: string[];
  updatedAt: string;
  updatedBy: string;
}

export type WriteResult = "ok" | "conflict" | "not_found";

export interface TemplateStore {
  list(): Promise<TemplateRecord[]>;
  insert(record: TemplateRecord): Promise<WriteResult>;
  update(record: TemplateRecord): Promise<WriteResult>;
}

// No sessions in the static build — the client sends the operator it picked.
// URL-encoded because header values must be ASCII.
export const OPERATOR_HEADER = "X-Operator-Name";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function handleTemplateApi(
  request: Request,
  store: TemplateStore,
  now: () => Date = () => new Date(),
  newId: () => string = () => crypto.randomUUID()
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const idMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
  if (pathname !== "/api/templates" && !idMatch) {
    return null;
  }

  if (request.method === "GET" && !idMatch) {
    return json(await store.list());
  }
  if (!(request.method === "POST" && !idMatch) && !(request.method === "PUT" && idMatch)) {
    return json({ error: "不支援的操作" }, 405);
  }

  let operator = "";
  try {
    operator = decodeURIComponent(request.headers.get(OPERATOR_HEADER) ?? "").trim();
  } catch {
    operator = "";
  }
  if (!operator) {
    return json({ error: "尚未選擇操作者" }, 401);
  }

  const { category, variantLabel, subject, body, requiredFields, optionalFields } = (await request.json()) as {
    category?: string;
    variantLabel?: string;
    subject?: string;
    body?: string;
    requiredFields?: string[];
    optionalFields?: string[];
  };
  if (!category || !subject || !body) {
    return json({ error: "類別、標題、內文為必填" }, 400);
  }

  const declaredFields = requiredFields ?? [];
  const record: TemplateRecord = {
    id: idMatch ? decodeURIComponent(idMatch[1]) : newId(),
    category,
    variantLabel: variantLabel?.trim() ? variantLabel.trim() : "不適用",
    subject,
    body,
    requiredFields: declaredFields,
    // Only fields the template actually declares can be optional.
    optionalFields: (optionalFields ?? []).filter((f) => declaredFields.includes(f)),
    updatedAt: now().toISOString(),
    updatedBy: operator,
  };

  const result = idMatch ? await store.update(record) : await store.insert(record);
  if (result === "conflict") {
    return json({ error: "這個類別已經有同名的變體了，請換個名稱或改用編輯" }, 400);
  }
  if (result === "not_found") {
    return json({ error: "找不到模板" }, 404);
  }

  const undeclaredFields = findUndeclaredFields(`${subject}\n${body}`, declaredFields);
  return json({ template: record, undeclaredFields }, idMatch ? 200 : 201);
}

// Minimal slice of the D1 binding this store uses.
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

interface TemplateRow {
  id: string;
  category: string;
  variant_label: string;
  subject: string;
  body: string;
  required_fields: string;
  optional_fields: string;
  updated_at: string;
  updated_by: string;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}

export function d1TemplateStore(db: D1Like): TemplateStore {
  return {
    async list() {
      const { results } = await db
        .prepare("SELECT * FROM templates ORDER BY category, variant_label")
        .bind()
        .all<TemplateRow>();
      return results.map((row) => ({
        id: row.id,
        category: row.category,
        variantLabel: row.variant_label,
        subject: row.subject,
        body: row.body,
        requiredFields: decodeRequiredFields(row.required_fields),
        optionalFields: decodeRequiredFields(row.optional_fields),
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      }));
    },
    async insert(r) {
      try {
        await db
          .prepare(
            "INSERT INTO templates (id, category, variant_label, subject, body, required_fields, optional_fields, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(r.id, r.category, r.variantLabel, r.subject, r.body, encodeRequiredFields(r.requiredFields), encodeRequiredFields(r.optionalFields), r.updatedAt, r.updatedBy)
          .run();
        return "ok";
      } catch (err) {
        if (isUniqueViolation(err)) return "conflict";
        throw err;
      }
    },
    async update(r) {
      try {
        const { meta } = await db
          .prepare(
            "UPDATE templates SET category = ?, variant_label = ?, subject = ?, body = ?, required_fields = ?, optional_fields = ?, updated_at = ?, updated_by = ? WHERE id = ?"
          )
          .bind(r.category, r.variantLabel, r.subject, r.body, encodeRequiredFields(r.requiredFields), encodeRequiredFields(r.optionalFields), r.updatedAt, r.updatedBy, r.id)
          .run();
        return meta.changes === 0 ? "not_found" : "ok";
      } catch (err) {
        if (isUniqueViolation(err)) return "conflict";
        throw err;
      }
    },
  };
}
