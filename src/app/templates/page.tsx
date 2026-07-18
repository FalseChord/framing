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
