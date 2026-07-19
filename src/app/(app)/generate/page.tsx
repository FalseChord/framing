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
          <h3>純文字版本（供核對）</h3>
          <pre>{result.plain}</pre>
          <button onClick={handleCopyAndOpenGmail}>複製格式化內文並開啟 Gmail 草稿</button>
        </section>
      )}
    </main>
  );
}
