const HIGHLIGHT_PATTERN = /\*\*(.+?)\*\*/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toHighlightedHtml(text: string): string {
  const segments = text.split(HIGHLIGHT_PATTERN);
  const html = segments
    .map((segment, index) =>
      index % 2 === 1 ? `<b style="background-color:#fff59d">${escapeHtml(segment)}</b>` : escapeHtml(segment)
    )
    .join("");
  return html.replace(/\n/g, "<br>");
}

export function stripHighlightMarkers(text: string): string {
  return text.replace(HIGHLIGHT_PATTERN, "$1");
}
