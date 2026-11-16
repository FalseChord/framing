import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import navStyles from "@/components/AppNav.module.css";
import GenerateLetterForm, { type GenerateOutcome, type GenerateRequest } from "@/components/GenerateLetterForm";
import { generateLetter } from "@/lib/letters/generateLetter";
import { MissingFieldsError } from "@/lib/letters/render";
import rawData from "./letters-data.json";
import type { StaticLettersData, StaticOperator } from "./data";

const data = rawData as StaticLettersData;

// The static build has no server session, so the chosen operator (whose code goes
// into the signature block) is remembered per browser instead. Storage can be
// unavailable (private window, blocked site data) — then the operator is simply
// asked again on the next visit.
const OPERATOR_STORAGE_KEY = "framing_operator_id";

function loadOperator(): StaticOperator | null {
  try {
    const id = localStorage.getItem(OPERATOR_STORAGE_KEY);
    return data.operators.find((o) => o.id === id) ?? null;
  } catch {
    return null;
  }
}

function saveOperator(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(OPERATOR_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(OPERATOR_STORAGE_KEY);
    }
  } catch {
    // ignore — see loadOperator
  }
}

function SelectOperator({ onSelect }: { onSelect: (operator: StaticOperator) => void }) {
  return (
    <main className="page-container" style={{ maxWidth: "480px" }}>
      <h1>請選擇目前操作者</h1>
      <ul className="list">
        {data.operators.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => onSelect(o)}
              style={{ width: "100%", margin: 0 }}
            >
              {o.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function App() {
  const [operator, setOperator] = useState<StaticOperator | null>(loadOperator);

  if (!operator) {
    return (
      <SelectOperator
        onSelect={(o) => {
          saveOperator(o.id);
          setOperator(o);
        }}
      />
    );
  }

  async function generate(request: GenerateRequest): Promise<GenerateOutcome> {
    const template = data.templates.find((t) => t.id === request.templateId);
    if (!template || !operator) {
      return { ok: false, error: "找不到模板" };
    }
    try {
      const letter = generateLetter({
        template,
        fields: request.fields,
        slotCount: request.slotCount,
        includeLine: request.includeLine,
        operatorSignature: operator.signature,
      });
      return { ok: true, subject: letter.renderedSubject, html: letter.renderedBodyHtml };
    } catch (err) {
      if (err instanceof MissingFieldsError) {
        return { ok: false, error: err.message, missingFields: err.missingFields };
      }
      throw err;
    }
  }

  return (
    <>
      <header className={navStyles.nav}>
        <div className={navStyles.navInner}>
          <span className={navStyles.brand}>信件模板系統</span>
          <span className={navStyles.identity} style={{ marginLeft: "auto" }}>
            目前操作者：{operator.name}（{operator.signature}）
            <button
              type="button"
              className={navStyles.switchLink}
              onClick={() => {
                saveOperator(null);
                setOperator(null);
              }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
            >
              切換操作者
            </button>
          </span>
        </div>
      </header>
      <div className="page-container">
        <GenerateLetterForm templates={data.templates} therapists={data.therapists} generate={generate} />
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          模板資料更新時間：{new Date(data.exportedAt).toLocaleString("zh-TW")}
        </p>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
