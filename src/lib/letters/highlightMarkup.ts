// `[\s\S]` (not `.`) is required so a **highlighted span** that itself contains a
// newline (e.g. multiple candidate session slots, one bullet per line) is still
// matched as a single span — `.` stops at `\n`, which would leave the `**` markers
// as literal text in the output instead of becoming bold+highlight. (The `s`/dotAll
// flag would do the same, but needs ES2018+; this project targets ES2017.)
const HIGHLIGHT_PATTERN = /\*\*([\s\S]+?)\*\*/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Gmail's own "一般/Normal" compose text measures 13px (confirmed via the
// browser's computed-style inspector — Gmail's font-size toolbar highlight is
// not a reliable signal of the actual pixel value, it doesn't distinguish an
// arbitrary custom size from a genuine 13px match). font-size is set on the
// outer wrapper AND repeated on every <b> tag rather than relying on CSS
// inheritance from a single wrapper alone, since prior attempts wrapping only
// at the call site were not reliably honored end to end.
const NORMAL_FONT_SIZE = "font-size:13px";

export function toHighlightedHtml(text: string): string {
  const segments = text.split(HIGHLIGHT_PATTERN);
  const html = segments
    .map((segment, index) =>
      index % 2 === 1
        ? `<b style="background-color:#fff59d;${NORMAL_FONT_SIZE}">${escapeHtml(segment)}</b>`
        : escapeHtml(segment)
    )
    .join("");
  return `<span style="${NORMAL_FONT_SIZE}">${html.replace(/\n/g, "<br>")}</span>`;
}

export function stripHighlightMarkers(text: string): string {
  return text.replace(HIGHLIGHT_PATTERN, "$1");
}
