import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import navStyles from "@/components/AppNav.module.css";
import GenerateLetterForm, { type GenerateOutcome, type GenerateRequest } from "@/components/GenerateLetterForm";
import TemplateManager from "@/components/TemplateManager";
import { generateLetter } from "@/lib/letters/generateLetter";
import { MissingFieldsError } from "@/lib/letters/render";
import rawData from "./letters-data.json";
import type { StaticLettersData, StaticOperator, StaticTemplate } from "./data";
import { OPERATOR_HEADER } from "../lib/templateApi";

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

// Fetched on every mount, so switching back from 模板管理 picks up edits.
function GeneratePanel({ operator }: { operator: StaticOperator }) {
  const [templates, setTemplates] = useState<StaticTemplate[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setTemplates)
      .catch(() => setLoadError("模板載入失敗，請重新整理頁面"));
  }, []);

  async function generate(request: GenerateRequest): Promise<GenerateOutcome> {
    const template = templates.find((t) => t.id === request.templateId);
    if (!template) {
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
      {loadError && <p role="alert">{loadError}</p>}
      <GenerateLetterForm templates={templates} therapists={data.therapists} generate={generate} />
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
        心理師／操作者名單更新時間：{new Date(data.exportedAt).toLocaleString("zh-TW")}
      </p>
    </>
  );
}

type View = "generate" | "templates";

function readView(): View {
  return window.location.hash === "#templates" ? "templates" : "generate";
}

function App() {
  const [operator, setOperator] = useState<StaticOperator | null>(loadOperator);
  const [view, setView] = useState<View>(readView);

  useEffect(() => {
    const onHashChange = () => setView(readView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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

  const linkStyle = (active: boolean) => ({
    color: active ? "var(--color-accent-strong)" : undefined,
    fontWeight: active ? 700 : undefined,
  });

  return (
    <>
      <header className={navStyles.nav}>
        <div className={navStyles.navInner}>
          <span className={navStyles.brand}>信件模板系統</span>
          <nav className={navStyles.links}>
            <a href="#generate" className={navStyles.link} style={linkStyle(view === "generate")}>
              產生信件
            </a>
            <a href="#templates" className={navStyles.link} style={linkStyle(view === "templates")}>
              模板管理
            </a>
          </nav>
          <span className={navStyles.identity}>
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
        {view === "templates" ? (
          <TemplateManager requestHeaders={{ [OPERATOR_HEADER]: encodeURIComponent(operator.name) }} />
        ) : (
          <GeneratePanel operator={operator} />
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
