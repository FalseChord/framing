export interface GmailDraftInput {
  to?: string;
  bcc?: string;
  subject: string;
  body?: string;
}

export function buildGmailComposeUrl(input: GmailDraftInput): string {
  const params = new URLSearchParams({ view: "cm", fs: "1" });
  if (input.to) params.set("to", input.to);
  if (input.bcc) params.set("bcc", input.bcc);
  params.set("su", input.subject);
  if (input.body) params.set("body", input.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
