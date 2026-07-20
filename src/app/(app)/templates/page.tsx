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
