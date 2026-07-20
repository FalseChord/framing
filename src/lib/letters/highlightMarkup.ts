// `[\s\S]` (not `.`) is required so a **highlighted span** that itself contains a
// newline (e.g. multiple candidate session slots, one bullet per line) is still
// matched as a single span — `.` stops at `\n`, which would leave the `**` markers
// as literal text in the output instead of becoming bold+highlight. (The `s`/dotAll
// flag would do the same, but needs ES2018+; this project targets ES2017.)
const HIGHLIGHT_PATTERN = /\*\*([\s\S]+?)\*\*/g;

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
