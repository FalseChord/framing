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
