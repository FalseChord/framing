import { describe, it, expect } from "vitest";
import { toHighlightedHtml, stripHighlightMarkers } from "./highlightMarkup";

describe("toHighlightedHtml", () => {
  it("wraps **text** in a bold+highlight span and leaves plain text untouched", () => {
    const result = toHighlightedHtml("已為您媒合心理師 **王小明**，請確認");
    expect(result).toBe('已為您媒合心理師 <b style="background-color:#fff59d">王小明</b>，請確認');
  });

  it("handles multiple highlighted spans in the same text", () => {
    const result = toHighlightedHtml("**A** 與 **B**");
    expect(result).toBe('<b style="background-color:#fff59d">A</b> 與 <b style="background-color:#fff59d">B</b>');
  });

  it("converts newlines to <br> for HTML display", () => {
    expect(toHighlightedHtml("第一行\n第二行")).toBe("第一行<br>第二行");
  });

  it("escapes HTML special characters in plain text", () => {
    expect(toHighlightedHtml("A<B>C")).toBe("A&lt;B&gt;C");
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
