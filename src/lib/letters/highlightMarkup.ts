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

// Bare links in the letter (meeting links typed into {{meetLink}}, URLs written
// into a template) become clickable <a> tags in the copied HTML. Matches
// http(s):// URLs plus scheme-less www. / meet.google.com/ ones, and stops at
// whitespace or full-width punctuation so a following "，" isn't swallowed.
const URL_PATTERN = /(?:https?:\/\/|www\.|meet\.google\.com\/)[^\s<，。、；：！？（）「」『』【】]+/g;

// Runs on already-escaped text, so "&" in a URL is "&amp;" — valid in an href.
function linkify(escapedText: string): string {
  return escapedText.replace(URL_PATTERN, (url) => {
    const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
    return `<a href="${href}" style="${NORMAL_FONT_SIZE}">${url}</a>`;
  });
}

export function toHighlightedHtml(text: string): string {
  const segments = text.split(HIGHLIGHT_PATTERN);
  const html = segments
    .map((segment, index) => {
      if (index % 2 !== 1) {
        return linkify(escapeHtml(segment));
      }
      const b = `<b style="background-color:#fff59d;${NORMAL_FONT_SIZE}">${linkify(escapeHtml(segment))}</b>`;
      if (!segment.includes("\n")) {
        return b;
      }
      // A multi-line span (e.g. several candidate slots, one per line) gets its
      // own lines: a line break before it and after it, unless the surrounding
      // text already has one. Otherwise trailing text (e.g. "，是否方便...")
      // runs onto the last bullet's line. This used to be display:block, but a
      // block's background fills the whole line width instead of stopping at
      // the last character — the <b> must stay inline.
      const before = segments[index - 1];
      const after = segments[index + 1];
      const breakBefore = before && !before.endsWith("\n") ? "\n" : "";
      const breakAfter = after && !after.startsWith("\n") ? "\n" : "";
      return `${breakBefore}${b}${breakAfter}`;
    })
    .join("");
  // HTML collapses leading spaces, which flattened the indented 注意事項 lists
  // ("    1. …", "        A. …") once pasted into Gmail. Keep them as &nbsp;.
  const withIndent = html.replace(/(^|\n)( +)/g, (_, lineStart: string, spaces: string) => lineStart + "&nbsp;".repeat(spaces.length));
  return `<span style="${NORMAL_FONT_SIZE}">${withIndent.replace(/\n/g, "<br>")}</span>`;
}

export function stripHighlightMarkers(text: string): string {
  return text.replace(HIGHLIGHT_PATTERN, "$1");
}
