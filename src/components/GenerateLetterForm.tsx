"use client";

import { useEffect, useRef, useState } from "react";
import flatpickr from "flatpickr";
import { MandarinTraditional } from "flatpickr/dist/l10n/zh-tw.js";
import "flatpickr/dist/flatpickr.min.css";
import { buildGmailComposeUrl } from "@/lib/letters/gmailUrl";
import { formatPaymentDeadline, formatSessionSlot, formatSessionSlots } from "@/lib/letters/dateFormat";

export interface TemplateItem {
  id: string;
  category: string;
  variantLabel: string;
  subject: string;
  requiredFields: string[];
  optionalFields: string[];
}

export interface TherapistItem {
  id: string;
  name: string;
  email: string | null;
}

export interface GenerateRequest {
  templateId: string;
  fields: Record<string, string>;
  slotCount?: number;
  includeLine: boolean;
}

export type GenerateOutcome =
  | { ok: true; subject: string; html: string }
  | { ok: false; error: string; missingFields?: string[] };

const FIELD_LABELS: Record<string, string> = {
  caseRef: "個案稱呼",
  therapistName: "心理師",
  sessionDate: "日期時段",
  sessionSlots: "候選時段",
  fee: "費用",
  eapPlanName: "EAP方案名稱",
  meetLink: "視訊連結",
  paymentDeadline: "付款期限",
  sessionNumber: "今年度第幾次（填數字）",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Single flatpickr-backed input covering both date and time in one calendar
// popup (calendar grid + scrollable time spinner), replacing the previous
// separate <input type="date"> + two number inputs. The input itself is
// read-only — selection only happens through the calendar UI.
function DateTimePicker({
  date,
  startTime,
  onChange,
}: {
  date: string;
  startTime: string;
  onChange: (patch: { date: string; startTime: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      enableTime: true,
      time_24hr: true,
      minuteIncrement: 5,
      dateFormat: "Y-m-d H:i",
      locale: MandarinTraditional,
      onChange: (selectedDates) => {
        const picked = selectedDates[0];
        if (!picked) return;
        onChangeRef.current({
          date: `${picked.getFullYear()}-${pad2(picked.getMonth() + 1)}-${pad2(picked.getDate())}`,
          startTime: `${pad2(picked.getHours())}:${pad2(picked.getMinutes())}`,
        });
      },
    });
    fpRef.current = fp;
    return () => fp.destroy();
  }, []);

  // Keep the widget in sync when the parent resets/changes the value
  // programmatically (e.g. switching template variant).
  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    if (date && startTime) {
      fp.setDate(`${date} ${startTime}`, false);
    } else {
      fp.clear(false);
    }
  }, [date, startTime]);

  return <input ref={inputRef} type="text" readOnly placeholder="點擊選擇日期與時間" required aria-label="日期與時間" />;
}

// All options visible at once (one click to choose, easy to scan) instead of a
// <select> that needs a click to open and another to pick.
function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
      {options.map((opt) => (
        <label key={opt.value} style={{ display: "inline-flex", alignItems: "center", width: "auto", fontWeight: "normal", margin: 0 }}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            required
            style={{ display: "inline-block", width: "auto", margin: "0 4px 0 0" }}
          />
          {opt.label}
        </label>
      ))}
    </div>
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
        placeholder="例：陳三一"
        aria-label="個案全名"
        style={{ width: "12em", maxWidth: "100%" }}
      />
      <span style={{ marginLeft: "8px", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
        輸入個案全名後，選擇信中的稱呼
      </span>
      <br />
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

// 媒合信不用密件副本、也不寄給心理師（雙方本來就會互相聯繫），其他信件類別
// 一律用密件副本 BCC 寄給心理師與個案，避免多位收件者互看到彼此的信箱。
// 這兩件事目前剛好是同一個條件，所以共用同一個函式。
function usesBcc(category: string | undefined): boolean {
  return category !== undefined && category !== "媒合信";
}

// 方案的顯示順序：一般 / 伴侶‧家庭 / 青壯 / 重大災害 / 公益 / EAP（EAP 放最後）。
// 不在清單中的方案名稱排在後面。
const VARIANT_ORDER = ["一般", "伴侶/家庭", "青壯", "重大災害", "公益", "EAP"];

function sortVariants(items: TemplateItem[]): TemplateItem[] {
  return [...items].sort((a, b) => {
    const ai = VARIANT_ORDER.indexOf(a.variantLabel);
    const bi = VARIANT_ORDER.indexOf(b.variantLabel);
    if (ai === -1 && bi === -1) return a.variantLabel.localeCompare(b.variantLabel, "zh-Hant");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// The letter-generation form, independent of where its data comes from: the full
// app feeds it from the API routes, the static build (static/) from data exported
// at build time. `generate` is the only thing that differs between the two.
export default function GenerateLetterForm({
  templates,
  therapists,
  generate,
}: {
  templates: TemplateItem[];
  therapists: TherapistItem[];
  generate: (request: GenerateRequest) => Promise<GenerateOutcome>;
}) {
  const [category, setCategory] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [textFields, setTextFields] = useState<Record<string, string>>({});
  const [sessionDateValue, setSessionDateValue] = useState<SlotFormState>(makeEmptySlot(undefined));
  const [sessionSlotValues, setSessionSlotValues] = useState<SlotFormState[]>([makeEmptySlot(undefined)]);
  const [therapistEmail, setTherapistEmail] = useState("");
  const [caseEmail, setCaseEmail] = useState("");
  const [includeLine, setIncludeLine] = useState(false);
  const [result, setResult] = useState<{ subject: string; html: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();
  const categoryVariants = sortVariants(templates.filter((t) => t.category === category));
  const showVariantPicker = categoryVariants.length > 1;
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const showsTherapistEmail = usesBcc(selectedTemplate?.category);

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
    if (!selectedTemplate) {
      setError("請先選擇信件類別與方案");
      return;
    }
    if (
      selectedTemplate.requiredFields.includes("therapistName") &&
      !therapists.some((t) => t.name === textFields.therapistName)
    ) {
      setError("請從清單中選擇一位心理師");
      return;
    }

    const fields: Record<string, string> = { ...textFields };
    let slotCount: number | undefined;

    if (selectedTemplate.requiredFields.includes("sessionDate")) {
      fields.sessionDate = sessionDateValue.date ? formatSessionSlot(sessionDateValue) : "";
    }
    // Derived, never typed: always 24h after the session start (needs sessionDate).
    if (selectedTemplate.requiredFields.includes("paymentDeadline")) {
      fields.paymentDeadline = sessionDateValue.date ? formatPaymentDeadline(sessionDateValue) : "";
    }
    if (selectedTemplate.requiredFields.includes("sessionSlots")) {
      const filledSlots = sessionSlotValues.filter((slot) => slot.date);
      const formatted = formatSessionSlots(filledSlots);
      fields.sessionSlots = formatted.text;
      slotCount = formatted.count;
    }

    const outcome = await generate({ templateId, fields, slotCount, includeLine });
    if (!outcome.ok) {
      if (outcome.missingFields && outcome.missingFields.length > 0) {
        const labels = outcome.missingFields.map((f) => FIELD_LABELS[f] ?? f);
        setError(`缺少必填欄位：${labels.join("、")}`);
      } else {
        setError(outcome.error);
      }
      return;
    }
    setResult({ subject: outcome.subject, html: outcome.html });
    setCopied(false);
  }

  // Copying and opening Gmail are two separate clicks on purpose. They can't share
  // one click handler: awaiting the clipboard write before window.open makes some
  // browsers (notably Safari) treat the popup as not user-initiated, so the draft
  // opened blank; opening the popup first moves focus to the new tab, and the
  // clipboard API then rejects the write because this document is no longer
  // focused — the subject/recipients arrived (they're in the URL) but the body
  // never reached the clipboard.
  async function handleCopy() {
    if (!result) return;
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
      setCopied(true);
    } catch {
      setError("複製到剪貼簿失敗，請確認瀏覽器已允許本網站使用剪貼簿權限");
    }
  }

  function handleOpenGmail() {
    if (!result) return;

    const missing: string[] = [];
    if (showsTherapistEmail && !therapistEmail.trim()) missing.push("心理師 Email");
    if (!caseEmail.trim()) missing.push("個案 Email");
    if (missing.length > 0) {
      setError(`請先填寫${missing.join("、")}，才能開啟 Gmail 草稿`);
      return;
    }
    setError("");

    const recipientEmails = [showsTherapistEmail ? therapistEmail : "", caseEmail].filter((e) => e.trim());
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
        <fieldset>
          <legend>信件類別</legend>
          <RadioGroup
            name="category"
            options={categories.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={handleCategoryChange}
          />
        </fieldset>

        {showVariantPicker && (
          <fieldset>
            <legend>方案</legend>
            <RadioGroup
              name="variant"
              options={categoryVariants.map((t) => ({ value: t.id, label: t.variantLabel }))}
              value={templateId}
              onChange={handleVariantChange}
            />
          </fieldset>
        )}

        {selectedTemplate?.requiredFields.map((fieldName) => {
          if (fieldName === "therapistName") {
            return (
              <label key={fieldName}>
                心理師
                <input
                  list="therapist-options"
                  value={textFields.therapistName ?? ""}
                  onChange={(e) => setTextField("therapistName", e.target.value)}
                  placeholder="輸入姓名以篩選"
                  required
                />
                <datalist id="therapist-options">
                  {therapists.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </label>
            );
          }
          if (fieldName === "sessionDate") {
            return (
              <fieldset key={fieldName}>
                <legend>日期時段</legend>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <DateTimePicker
                    date={sessionDateValue.date}
                    startTime={sessionDateValue.startTime}
                    onChange={(patch) => setSessionDateValue({ ...sessionDateValue, ...patch })}
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
                    <DateTimePicker
                      date={slot.date}
                      startTime={slot.startTime}
                      onChange={(patch) => updateSlot(index, patch)}
                    />
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
          if (fieldName === "paymentDeadline") {
            // Computed from 日期時段 in handleGenerate — no input of its own.
            return null;
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
              {selectedTemplate.optionalFields.includes(fieldName) && "（選填）"}
              <input
                value={textFields[fieldName] ?? ""}
                onChange={(e) => setTextField(fieldName, e.target.value)}
                required={!selectedTemplate.optionalFields.includes(fieldName)}
              />
            </label>
          );
        })}

        {selectedTemplate && (
          <fieldset>
            <legend>
              {showsTherapistEmail ? "心理師與個案 Email" : "個案 Email"}
              （{usesBcc(selectedTemplate.category) ? "將加入密件副本 BCC" : "將加入收件者"}）
            </legend>
            {showsTherapistEmail && (
              <label>
                心理師 Email（選了心理師會自動帶入，可修改）
                <input type="email" value={therapistEmail} onChange={(e) => setTherapistEmail(e.target.value)} />
              </label>
            )}
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
        <button type="submit" className="button button-primary">
          產生信件
        </button>
      </form>
      {result && (
        <section>
          <h2>產出結果</h2>
          <p>主旨：{result.subject}</p>
          <p>
            {usesBcc(selectedTemplate?.category) ? "密件副本 BCC" : "收件者"}：
            {[showsTherapistEmail ? therapistEmail : "", caseEmail].filter((e) => e.trim()).join("、") || "（尚未填寫）"}
          </p>
          <div dangerouslySetInnerHTML={{ __html: result.html }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="button button-primary" onClick={handleCopy}>
              1. 複製格式化內文
            </button>
            <button type="button" className="button button-primary" onClick={handleOpenGmail}>
              2. 開啟 Gmail 草稿
            </button>
            {copied && <span>✓ 內文已複製，開啟草稿後在內文處貼上即可</span>}
          </div>
        </section>
      )}
    </main>
  );
}
