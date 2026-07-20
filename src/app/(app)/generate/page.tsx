"use client";

import { useEffect, useId, useState } from "react";
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
}

const FIELD_LABELS: Record<string, string> = {
  fee: "費用",
};

const TIME_SELECT_HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const TIME_SELECT_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function padTimePart(v: string): string {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? "" : String(n).padStart(2, "0");
}

// Free-typing input backed by a <datalist> suggestion list, instead of a native
// <select> — faster to use than scrolling a 24-option dropdown, and lets the
// operator type an odd time (e.g. 19:07) that isn't in the 5-minute list.
function TimeSelect({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const id = useId();
  const [hour, minute] = value.split(":");

  return (
    <>
      <input
        list={`${id}-hours`}
        value={hour ?? ""}
        onChange={(e) => onChange(`${e.target.value}:${minute ?? "00"}`)}
        onBlur={(e) => onChange(`${padTimePart(e.target.value)}:${minute ?? "00"}`)}
        placeholder="時"
        maxLength={2}
        style={{ width: "3em" }}
        required
        aria-label="時"
      />
      <datalist id={`${id}-hours`}>
        {TIME_SELECT_HOURS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      :
      <input
        list={`${id}-minutes`}
        value={minute ?? ""}
        onChange={(e) => onChange(`${hour ?? "00"}:${e.target.value}`)}
        onBlur={(e) => onChange(`${hour ?? "00"}:${padTimePart(e.target.value)}`)}
        placeholder="分"
        maxLength={2}
        style={{ width: "3em" }}
        required
        aria-label="分"
      />
      <datalist id={`${id}-minutes`}>
        {TIME_SELECT_MINUTES.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
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
}

const EMPTY_SLOT: SlotFormState = { date: "", startTime: "" };

// 伴侶/家庭方案固定 80 分鐘，其他所有方案固定 50 分鐘 —— 時長由方案決定，操作者不需要（也不能）另外選擇。
function getDurationMinutes(variantLabel: string | undefined): number {
  return variantLabel === "伴侶/家庭" ? 80 : 50;
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
    const durationMinutes = getDurationMinutes(selectedTemplate.variantLabel);

    if (selectedTemplate.requiredFields.includes("sessionDate")) {
      fields.sessionDate = sessionDateValue.date
        ? formatSessionSlot({ ...sessionDateValue, durationMinutes })
        : "";
    }
    if (selectedTemplate.requiredFields.includes("sessionSlots")) {
      const filledSlots = sessionSlotValues
        .filter((slot) => slot.date)
        .map((slot) => ({ ...slot, durationMinutes }));
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
    // Gmail's own font-size dropdown maps "一般/Normal" to the CSS keyword `small`
    // (not a specific px value) in the HTML it generates — matching that exactly is
    // what makes pasted content look the same size as text typed directly in Gmail.
    const htmlForClipboard = `<span style="font-family:Arial,sans-serif;font-size:small;">${result.html}</span>`;
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
                （時長 {getDurationMinutes(selectedTemplate?.variantLabel)} 分鐘）
              </fieldset>
            );
          }
          if (fieldName === "sessionSlots") {
            return (
              <fieldset key={fieldName}>
                <legend>候選時段（可新增多筆，時長 {getDurationMinutes(selectedTemplate?.variantLabel)} 分鐘）</legend>
                {sessionSlotValues.map((slot, index) => (
                  <div key={index}>
                    <input type="date" value={slot.date} onChange={(e) => updateSlot(index, { date: e.target.value })} required />
                    <TimeSelect
                      value={slot.startTime}
                      onChange={(startTime) => updateSlot(index, { startTime })}
                    />
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
