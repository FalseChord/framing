"use client";

import { useEffect, useState } from "react";
import GenerateLetterForm, {
  type GenerateOutcome,
  type GenerateRequest,
  type TemplateItem,
  type TherapistItem,
} from "@/components/GenerateLetterForm";

async function generateViaApi(request: GenerateRequest): Promise<GenerateOutcome> {
  const res = await fetch("/api/letters/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data.error, missingFields: data.missingFields };
  }
  return { ok: true, subject: data.renderedSubject, html: data.renderedBodyHtml };
}

export default function GeneratePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/therapists").then((r) => r.json()).then(setTherapists);
  }, []);

  return <GenerateLetterForm templates={templates} therapists={therapists} generate={generateViaApi} />;
}
