import { describe, it, expect } from "vitest";
import { resolveVariantBlocks } from "./variantBlocks";

describe("resolveVariantBlocks", () => {
  it("keeps the [只有] block content when the variant matches", () => {
    const text = "共用開頭\n[只有 EAP]\nEAP限定文字\n[/只有]\n共用結尾";
    expect(resolveVariantBlocks(text, "EAP")).toBe("共用開頭\n\nEAP限定文字\n\n共用結尾");
  });

  it("removes the [只有] block content when the variant does not match", () => {
    const text = "共用開頭\n[只有 EAP]\nEAP限定文字\n[/只有]\n共用結尾";
    expect(resolveVariantBlocks(text, "一般")).toBe("共用開頭\n\n共用結尾");
  });

  it("supports multiple variant names separated by 、", () => {
    const text = "[只有 青壯、北捷]差異文字[/只有]";
    expect(resolveVariantBlocks(text, "青壯")).toBe("差異文字");
    expect(resolveVariantBlocks(text, "公益")).toBe("");
  });

  it("keeps [除外] block content when the variant is not in the excluded list", () => {
    const text = "[除外 EAP]非EAP文字[/除外]";
    expect(resolveVariantBlocks(text, "一般")).toBe("非EAP文字");
    expect(resolveVariantBlocks(text, "EAP")).toBe("");
  });

  it("leaves text outside any block untouched", () => {
    expect(resolveVariantBlocks("純共用文字，沒有任何區塊", "一般")).toBe("純共用文字，沒有任何區塊");
  });
});
