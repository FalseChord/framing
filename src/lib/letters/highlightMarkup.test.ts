import { describe, it, expect } from "vitest";
import { toHighlightedHtml, stripHighlightMarkers } from "./highlightMarkup";

describe("toHighlightedHtml", () => {
  it("wraps **text** in a bold+highlight span and leaves plain text untouched", () => {
    const result = toHighlightedHtml("已為您媒合心理師 **王小明**，請確認");
    expect(result).toBe(
      '<span style="font-size:13px">已為您媒合心理師 <b style="background-color:#fff59d;font-size:13px">王小明</b>，請確認</span>'
    );
  });

  it("handles multiple highlighted spans in the same text", () => {
    const result = toHighlightedHtml("**A** 與 **B**");
    expect(result).toBe(
      '<span style="font-size:13px"><b style="background-color:#fff59d;font-size:13px">A</b> 與 <b style="background-color:#fff59d;font-size:13px">B</b></span>'
    );
  });

  it("converts newlines to <br> for HTML display", () => {
    expect(toHighlightedHtml("第一行\n第二行")).toBe('<span style="font-size:13px">第一行<br>第二行</span>');
  });

  it("escapes HTML special characters in plain text", () => {
    expect(toHighlightedHtml("A<B>C")).toBe('<span style="font-size:13px">A&lt;B&gt;C</span>');
  });

  it("matches a highlighted span that itself contains a newline (e.g. multiple candidate slots)", () => {
    const result = toHighlightedHtml("時段：**◉ 7/22 (三) 19:00-19:50\n◉ 7/24 (五) 20:00-20:50**，請確認");
    expect(result).toBe(
      '<span style="font-size:13px">時段：<b style="background-color:#fff59d;font-size:13px">◉ 7/22 (三) 19:00-19:50<br>◉ 7/24 (五) 20:00-20:50</b>，請確認</span>'
    );
  });

  it("sets font-size:13px directly on every <b> tag, not just the outer wrapper — matches Gmail's own measured Normal size (16px was measured wrong, 13px is Gmail's actual Normal)", () => {
    const result = toHighlightedHtml("**粗體**與純文字");
    expect(result).toContain('<span style="font-size:13px">');
    expect(result).toContain('style="background-color:#fff59d;font-size:13px">粗體</b>');
  });
});

describe("stripHighlightMarkers", () => {
  it("removes ** markers while keeping the wrapped text", () => {
    expect(stripHighlightMarkers("已媒合 **王小明** 心理師")).toBe("已媒合 王小明 心理師");
  });

  it("leaves text with no markers untouched", () => {
    expect(stripHighlightMarkers("沒有標記的文字")).toBe("沒有標記的文字");
  });
});
