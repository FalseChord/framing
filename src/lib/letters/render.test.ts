import { describe, it, expect } from "vitest";
import { renderLetter, MissingFieldsError } from "./render";

describe("renderLetter", () => {
  const templateBody =
    "親愛的 {{caseRef}}：心理師為 {{therapistName}}。" +
    "[只有 EAP]本次由 EAP 支付。[/只有]" +
    "[除外 EAP]請自費。[/除外]";

  it("substitutes fields and keeps the matching variant block", () => {
    const result = renderLetter({
      templateBody,
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
      variant: "EAP",
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。本次由 EAP 支付。");
  });

  it("falls back to the [除外] block for a non-matching variant", () => {
    const result = renderLetter({
      templateBody,
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
      variant: "一般",
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。請自費。");
  });

  it("throws MissingFieldsError listing every empty required field", () => {
    expect(() =>
      renderLetter({
        templateBody,
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "", therapistName: "" },
        variant: "一般",
      })
    ).toThrowError(MissingFieldsError);
  });

  it("lists exactly the missing field names on the thrown error", () => {
    try {
      renderLetter({
        templateBody,
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "A001", therapistName: "" },
        variant: "一般",
      });
      throw new Error("expected renderLetter to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFieldsError);
      expect((err as MissingFieldsError).missingFields).toEqual(["therapistName"]);
    }
  });

  it("resolves slot blocks using slotCount alongside variant blocks", () => {
    const result = renderLetter({
      templateBody: "[單一時段]時間為 {{sessionSlots}}[/單一時段][多個時段]候選時間：{{sessionSlots}}[/多個時段]",
      requiredFields: ["sessionSlots"],
      fields: { sessionSlots: "7/22 (三) 19:00-20:20" },
      variant: "不適用",
      slotCount: 1,
    });
    expect(result).toBe("時間為 7/22 (三) 19:00-20:20");
  });
});
