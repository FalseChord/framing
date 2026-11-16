import { describe, it, expect } from "vitest";
import { handleTemplateApi, OPERATOR_HEADER, type TemplateRecord, type TemplateStore } from "./templateApi";

function memoryStore(initial: TemplateRecord[] = []): TemplateStore & { rows: TemplateRecord[] } {
  const rows = [...initial];
  const clash = (r: TemplateRecord) =>
    rows.some((x) => x.id !== r.id && x.category === r.category && x.variantLabel === r.variantLabel);
  return {
    rows,
    async list() {
      return rows;
    },
    async insert(r) {
      if (clash(r)) return "conflict";
      rows.push(r);
      return "ok";
    },
    async update(r) {
      const i = rows.findIndex((x) => x.id === r.id);
      if (i === -1) return "not_found";
      if (clash(r)) return "conflict";
      rows[i] = r;
      return "ok";
    },
  };
}

const NOW = () => new Date("2026-11-16T00:00:00.000Z");
const ID = () => "new-id";

function req(method: string, path: string, body?: unknown, operator = "山羌"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (operator) headers[OPERATOR_HEADER] = encodeURIComponent(operator);
  return new Request(`https://example.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const valid = {
  category: "媒合信",
  variantLabel: "一般",
  subject: "主旨 {{caseRef}}",
  body: "內文 {{caseRef}} {{meetLink}} {{typo}}",
  requiredFields: ["caseRef", "meetLink"],
  optionalFields: ["meetLink", "notDeclared"],
};

describe("handleTemplateApi", () => {
  it("ignores paths outside /api/templates", async () => {
    expect(await handleTemplateApi(req("GET", "/"), memoryStore(), NOW, ID)).toBeNull();
  });

  it("creates a template, recording the operator and dropping undeclared optional fields", async () => {
    const store = memoryStore();
    const res = (await handleTemplateApi(req("POST", "/api/templates", valid), store, NOW, ID))!;
    expect(res.status).toBe(201);
    const data = (await res.json()) as { template: TemplateRecord; undeclaredFields: string[] };
    expect(data.template).toMatchObject({ id: "new-id", updatedBy: "山羌", optionalFields: ["meetLink"] });
    expect(data.undeclaredFields).toEqual(["typo"]);
    expect(store.rows).toHaveLength(1);
  });

  it("requires an operator for writes", async () => {
    const res = (await handleTemplateApi(req("POST", "/api/templates", valid, ""), memoryStore(), NOW, ID))!;
    expect(res.status).toBe(401);
  });

  it("rejects missing category/subject/body", async () => {
    const res = (await handleTemplateApi(req("POST", "/api/templates", { ...valid, body: "" }), memoryStore(), NOW, ID))!;
    expect(res.status).toBe(400);
  });

  it("reports a duplicate category+variant as a 400 with the same message as the full app", async () => {
    const store = memoryStore();
    await handleTemplateApi(req("POST", "/api/templates", valid), store, NOW, () => "a");
    const res = (await handleTemplateApi(req("POST", "/api/templates", valid), store, NOW, () => "b"))!;
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("同名的變體");
  });

  it("updates an existing template and 404s an unknown one", async () => {
    const store = memoryStore();
    await handleTemplateApi(req("POST", "/api/templates", valid), store, NOW, () => "a");
    const ok = (await handleTemplateApi(req("PUT", "/api/templates/a", { ...valid, subject: "新主旨" }, "張巽"), store, NOW, ID))!;
    expect(ok.status).toBe(200);
    expect(store.rows[0]).toMatchObject({ subject: "新主旨", updatedBy: "張巽" });
    const missing = (await handleTemplateApi(req("PUT", "/api/templates/zzz", valid), store, NOW, ID))!;
    expect(missing.status).toBe(404);
  });

  it("lists templates", async () => {
    const store = memoryStore();
    await handleTemplateApi(req("POST", "/api/templates", valid), store, NOW, ID);
    const res = (await handleTemplateApi(req("GET", "/api/templates"), store, NOW, ID))!;
    expect(await res.json()).toHaveLength(1);
  });
});
