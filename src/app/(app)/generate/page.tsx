"use client";

import { useEffect, useState } from "react";
import { buildGmailComposeUrl } from "@/lib/letters/gmailUrl";
import { formatSessionSlot, formatSessionSlots, type SessionSlotInput } from "@/lib/letters/dateFormat";

interface TemplateItem {
  id: string;
  category: string;
  variantLabel: string;
  subject: string;
  requiredFields: string[];
}

interface Therapist {
  id: string;
  name: string;
}

const TIME_SELECT_HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const TIME_SELECT_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function TimeSelect({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [hour, minute] = value.split(":");

  return (
    <>
      <select
        value={hour ?? ""}
        onChange={(e) => onChange(`${e.target.value}:${minute ?? "00"}`)}
        required
        aria-label="時"
      >
        <option value="">時</option>
        {TIME_SELECT_HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      :
      <select
        value={minute ?? ""}
        onChange={(e) => onChange(`${hour ?? "00"}:${e.target.value}`)}
        required
        aria-label="分"
      >
        <option value="">分</option>
        {TIME_SELECT_MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </>
  );
}

type DurationMode = "50" | "80" | "other";

interface SlotFormState extends SessionSlotInput {
  durationMode: DurationMode;
}

const EMPTY_SLOT: SlotFormState = { date: "", startTime: "", durationMinutes: 50, durationMode: "50" };

function DurationPicker({
  slot,
  onChange,
}: {
  slot: SlotFormState;
  onChange: (patch: Partial<SlotFormState>) => void;
}) {
  return (
    <>
      ，時長
      <select
        value={slot.durationMode}
        onChange={(e) => {
          const mode = e.target.value as DurationMode;
          if (mode === "50") onChange({ durationMode: "50", durationMinutes: 50 });
          else if (mode === "80") onChange({ durationMode: "80", durationMinutes: 80 });
          else onChange({ durationMode: "other", durationMinutes: 0 });
        }}
        required
      >
        <option value="50">50分鐘</option>
        <option value="80">80分鐘</option>
        <option value="other">其他</option>
      </select>
      {slot.durationMode === "other" && (
        <input
          type="number"
          min={1}
          value={slot.durationMinutes || ""}
          onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}
          placeholder="分鐘數"
          required
        />
      )}
    </>
  );
}

export default function GeneratePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [category, setCategory] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [sessionDateValue, setSessionDateValue] = useState<SlotFormState>(EMPTY_SLOT);
  const [sessionSlotValues, setSessionSlotValues] = useState<SlotFormState[]>([EMPTY_SLOT]);
  const [toEmails, setToEmails] = useState<string[]>([""]);
  const [bccEmails, setBccEmails] = useState<string[]>([""]);
  const [includeLine, setIncludeLine] = useState(false);
  const [result, setResult] = useState<{ subject: string; html: string; plain: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/therapists").then((r) => r.json()).then(setTherapists);
  }, []);

  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();
  const categoryVariants = templates.filter((t) => t.category === category);
  const showVariantPicker = categoryVariants.length > 1;
  const selectedTemplate = templates.find((t) => t.id === templateId);

  function resetFormState() {
    setTextFields({});
    setSessionDateValue(EMPTY_SLOT);
    setSessionSlotValues([EMPTY_SLOT]);
    setResult(null);
    setError("");
  }

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const variants = templates.filter((t) => t.category === nextCategory);
    setTemplateId(variants.length === 1 ? variants[0].id : "");
    resetFormState();
  }

  function handleVariantChange(id: string) {
    setTemplateId(id);
    resetFormState();
  }

  function setTextField(name: string, value: string) {
    setTextFields((prev) => ({ ...prev, [name]: value }));
  }

  function updateSlot(index: number, patch: Partial<SlotFormState>) {
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
      body: JSON.stringify({ templateId, fields, slotCount, includeLine }),
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
    // Wrapped with an explicit normal-size font so Gmail's paste handler doesn't
    // fall back to an oversized default for unstyled pasted HTML.
    const htmlForClipboard = `<span style="font-family:Arial,sans-serif;font-size:14px;">${result.html}</span>`;
    const htmlBlob = new Blob([htmlForClipboard], { type: "text/html" });
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
          信件類別
          <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} required>
            <option value="">請選擇</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {showVariantPicker && (
          <label>
            方案
            <select value={templateId} onChange={(e) => handleVariantChange(e.target.value)} required>
              <option value="">請選擇</option>
              {categoryVariants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.variantLabel}
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
                <TimeSelect
                  value={sessionDateValue.startTime}
                  onChange={(startTime) => setSessionDateValue({ ...sessionDateValue, startTime })}
                />
                <DurationPicker
                  slot={sessionDateValue}
                  onChange={(patch) => setSessionDateValue({ ...sessionDateValue, ...patch })}
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
                    <TimeSelect
                      value={slot.startTime}
                      onChange={(startTime) => updateSlot(index, { startTime })}
                    />
                    <DurationPicker slot={slot} onChange={(patch) => updateSlot(index, patch)} />
                    {sessionSlotValues.length > 1 && (
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => setSessionSlotValues(sessionSlotValues.filter((_, i) => i !== index))}
                      >
                        刪除
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="button button-secondary" onClick={() => setSessionSlotValues([...sessionSlotValues, EMPTY_SLOT])}>
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
                <button type="button" className="button button-danger" onClick={() => setToEmails(toEmails.filter((_, i) => i !== index))}>
                  刪除
                </button>
              )}
            </div>
          ))}
          <button type="button" className="button button-secondary" onClick={() => setToEmails([...toEmails, ""])}>
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
                <button type="button" className="button button-danger" onClick={() => setBccEmails(bccEmails.filter((_, i) => i !== index))}>
                  刪除
                </button>
              )}
            </div>
          ))}
          <button type="button" className="button button-secondary" onClick={() => setBccEmails([...bccEmails, ""])}>
            新增密件副本
          </button>
        </fieldset>

        <label>
          <input type="checkbox" checked={includeLine} onChange={(e) => setIncludeLine(e.target.checked)} style={{ display: "inline-block", width: "auto", marginRight: "8px" }} />
          附加官方 LINE 聯繫方式
        </label>

        {error && <p role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={!templateId}>
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
          <button className="button button-primary" onClick={handleCopyAndOpenGmail}>
            複製格式化內文並開啟 Gmail 草稿
          </button>
        </section>
      )}
    </main>
  );
}
