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
