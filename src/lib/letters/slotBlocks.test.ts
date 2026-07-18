import { describe, it, expect } from "vitest";
import { resolveSlotBlocks } from "./slotBlocks";

describe("resolveSlotBlocks", () => {
  const text =
    "[單一時段]單一時段文字 {{sessionSlots}}[/單一時段]" +
    "[多個時段]多時段文字 {{sessionSlots}}[/多個時段]";

  it("keeps only the single-slot block when slotCount is 1", () => {
    expect(resolveSlotBlocks(text, 1)).toBe("單一時段文字 {{sessionSlots}}");
  });

  it("keeps only the multi-slot block when slotCount is 2 or more", () => {
    expect(resolveSlotBlocks(text, 2)).toBe("多時段文字 {{sessionSlots}}");
  });

  it("keeps neither block when slotCount is 0", () => {
    expect(resolveSlotBlocks(text, 0)).toBe("");
  });

  it("leaves text with no slot blocks untouched", () => {
    expect(resolveSlotBlocks("沒有任何時段區塊的文字", 1)).toBe("沒有任何時段區塊的文字");
  });
});
