"use client";

import { useEffect, useState } from "react";
import { buildGmailComposeUrl } from "@/lib/letters/gmailUrl";
import { formatSessionSlot, formatSessionSlots } from "@/lib/letters/dateFormat";

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
  email: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  caseRef: "個案稱呼",
  therapistName: "心理師",
  sessionDate: "日期時段",
  sessionSlots: "候選時段",
  fee: "費用",
  eapPlanName: "EAP方案名稱",
  meetLink: "視訊連結",
};

function padTimePart(v: string, max: number): string {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? "" : String(Math.min(Math.max(n, 0), max)).padStart(2, "0");
}

// Plain number inputs — no dropdown, no autocomplete/filter behavior to fight.
// The operator can type any hour/minute directly; padded to two digits on blur.
function TimeSelect({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [hour, minute] = value.split(":");

  return (
    <>
      <input
        type="number"
        min={0}
        max={23}
        value={hour ?? ""}
        onChange={(e) => onChange(`${e.target.value}:${minute ?? "00"}`)}
        onBlur={(e) => onChange(`${padTimePart(e.target.value, 23)}:${minute ?? "00"}`)}
        placeholder="時"
        style={{ width: "4em" }}
        required
        aria-label="時"
      />
      :
      <input
        type="number"
        min={0}
        max={59}
        step={5}
        value={minute ?? ""}
        onChange={(e) => onChange(`${hour ?? "00"}:${e.target.value}`)}
        onBlur={(e) => onChange(`${hour ?? "00"}:${padTimePart(e.target.value, 59)}`)}
        placeholder="分"
        style={{ width: "4em" }}
        required
        aria-label="分"
      />
    </>
  );
}

function CaseRefPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fullName, setFullName] = useState("");
  const surname = fullName.slice(0, 1);
  const givenName = fullName.slice(1);
  // 姓氏一律取第一個字，複姓（如歐陽）不會被正確拆開，需要操作者自行判斷。
  const options = givenName ? [`${surname}先生`, `${surname}小姐`, givenName] : [];

  return (
    <>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="輸入個案全名，例如：陳三一"
      />
      {options.map((opt) => (
        <label key={opt} style={{ display: "inline-block", width: "auto", fontWeight: "normal", marginRight: "16px" }}>
          <input
            type="radio"
            name="caseRefOption"
            checked={value === opt}
            onChange={() => onChange(opt)}
            required
            style={{ display: "inline-block", width: "auto", marginRight: "4px" }}
          />
          {opt}
        </label>
      ))}
    </>
  );
}

interface SlotFormState {
  date: string;
  startTime: string;
  durationMinutes: number;
}

// 伴侶/家庭方案預設 80 分鐘，其他所有方案預設 50 分鐘 —— 只是預設值，操作者仍可自行修改。
function getDefaultDurationMinutes(variantLabel: string | undefined): number {
  return variantLabel === "伴侶/家庭" ? 80 : 50;
}

function makeEmptySlot(variantLabel: string | undefined): SlotFormState {
  return { date: "", startTime: "", durationMinutes: getDefaultDurationMinutes(variantLabel) };
}

// 媒合信用一般收件者，其他信件類別一律用密件副本 BCC，避免多位收件者互看到彼此的信箱。
function usesBcc(category: string | undefined): boolean {
  return category !== undefined && category !== "媒合信";
}

export default function GeneratePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [category, setCategory] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [sessionDateValue, setSessionDateValue] = useState<SlotFormState>(makeEmptySlot(undefined));
  const [sessionSlotValues, setSessionSlotValues] = useState<SlotFormState[]>([makeEmptySlot(undefined)]);
  const [therapistEmail, setTherapistEmail] = useState("");
  const [caseEmail, setCaseEmail] = useState("");
  const [includeLine, setIncludeLine] = useState(false);
  const [result, setResult] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/therapists").then((r) => r.json()).then(setTherapists);
  }, []);

  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();
  const categoryVariants = templates.filter((t) => t.category === category);
  const showVariantPicker = categoryVariants.length > 1;
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // 選了心理師後，自動從資料庫帶入該心理師的 Email（操作者仍可手動修改/覆寫）。
  useEffect(() => {
    const match = therapists.find((t) => t.name === textFields.therapistName);
    setTherapistEmail(match?.email ?? "");
  }, [textFields.therapistName, therapists]);

  function resetFormState(variantLabel: string | undefined) {
    setTextFields({});
    setSessionDateValue(makeEmptySlot(variantLabel));
    setSessionSlotValues([makeEmptySlot(variantLabel)]);
    setCaseEmail("");
    setResult(null);
    setError("");
  }

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const variants = templates.filter((t) => t.category === nextCategory);
    const nextId = variants.length === 1 ? variants[0].id : "";
    setTemplateId(nextId);
    resetFormState(variants.length === 1 ? variants[0].variantLabel : undefined);
  }

  function handleVariantChange(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    resetFormState(t?.variantLabel);
  }

  function setTextField(name: string, value: string) {
    setTextFields((prev) => ({ ...prev, [name]: value }));
  }

  function updateSlot(index: number, patch: Partial<SlotFormState>) {
    setSessionSlotValues((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
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
      if (Array.isArray(data.missingFields) && data.missingFields.length > 0) {
        const labels = data.missingFields.map((f: string) => FIELD_LABELS[f] ?? f);
        setError(`缺少必填欄位：${labels.join("、")}`);
      } else {
        setError(data.error);
      }
      return;
    }
    setResult({ subject: data.renderedSubject, html: data.renderedBodyHtml });
  }

  async function handleCopyAndOpenGmail() {
    if (!result) return;
    if (!therapistEmail.trim() || !caseEmail.trim()) {
      setError("請先填寫心理師與個案的 Email，才能開啟 Gmail 草稿");
      return;
    }
    setError("");

    try {
      // result.html (toHighlightedHtml) already carries font-size:13px on every
      // element — Gmail's own measured "一般/Normal" size. This wrapper only adds
      // an email-safe font-family on top; it does not need to repeat font-size.
      // Only text/html is written: Gmail's normal paste always prefers text/html
      // over text/plain when both are present, so a plain-text fallback entry
      // has no effect on what actually gets pasted into the opened draft.
      const htmlForClipboard = `<span style="font-family:Arial,sans-serif;">${result.html}</span>`;
      const htmlBlob = new Blob([htmlForClipboard], { type: "text/html" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob })]);
    } catch {
      setError("複製到剪貼簿失敗，請確認瀏覽器已允許本網站使用剪貼簿權限");
      return;
    }

    const recipientEmails = [therapistEmail, caseEmail].filter((e) => e.trim());
    const routeToBcc = usesBcc(selectedTemplate?.category);

    const url = buildGmailComposeUrl({
      to: (routeToBcc ? [] : recipientEmails).join(","),
      bcc: (routeToBcc ? recipientEmails : []).join(","),
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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
                  <input
                    type="number"
                    min={1}
                    value={sessionDateValue.durationMinutes}
                    onChange={(e) =>
                      setSessionDateValue({ ...sessionDateValue, durationMinutes: Number(e.target.value) })
                    }
                    style={{ width: "4em" }}
                    required
                    aria-label="時長（分鐘）"
                  />
                  分鐘
                </div>
              </fieldset>
            );
          }
          if (fieldName === "sessionSlots") {
            return (
              <fieldset key={fieldName}>
                <legend>候選時段（可新增多筆）</legend>
                {sessionSlotValues.map((slot, index) => (
                  <div
                    key={index}
                    style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}
                  >
                    <input type="date" value={slot.date} onChange={(e) => updateSlot(index, { date: e.target.value })} required />
                    <TimeSelect value={slot.startTime} onChange={(startTime) => updateSlot(index, { startTime })} />
                    <input
                      type="number"
                      min={1}
                      value={slot.durationMinutes}
                      onChange={(e) => updateSlot(index, { durationMinutes: Number(e.target.value) })}
                      style={{ width: "4em" }}
                      required
                      aria-label="時長（分鐘）"
                    />
                    分鐘
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
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setSessionSlotValues([...sessionSlotValues, makeEmptySlot(selectedTemplate?.variantLabel)])}
                >
                  新增時段
                </button>
              </fieldset>
            );
          }
          if (fieldName === "caseRef") {
            return (
              <fieldset key={fieldName}>
                <legend>個案稱呼</legend>
                <CaseRefPicker value={textFields.caseRef ?? ""} onChange={(v) => setTextField("caseRef", v)} />
              </fieldset>
            );
          }
          return (
            <label key={fieldName}>
              {FIELD_LABELS[fieldName] ?? fieldName}
              <input value={textFields[fieldName] ?? ""} onChange={(e) => setTextField(fieldName, e.target.value)} required />
            </label>
          );
        })}

        {selectedTemplate && (
          <fieldset>
            <legend>
              心理師與個案 Email（{usesBcc(selectedTemplate.category) ? "將加入密件副本 BCC" : "將加入收件者"}）
            </legend>
            <label>
              心理師 Email（選了心理師會自動帶入，可修改）
              <input type="email" value={therapistEmail} onChange={(e) => setTherapistEmail(e.target.value)} />
            </label>
            <label>
              個案 Email
              <input type="email" value={caseEmail} onChange={(e) => setCaseEmail(e.target.value)} />
            </label>
          </fieldset>
        )}

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
          <button className="button button-primary" onClick={handleCopyAndOpenGmail}>
            複製格式化內文並開啟 Gmail 草稿
          </button>
        </section>
      )}
    </main>
  );
}
