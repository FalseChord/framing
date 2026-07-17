import { describe, it, expect } from "vitest";
import { renderLetter, MissingFieldsError } from "./render";

describe("renderLetter", () => {
  const templateBody =
    "親愛的 {{caseRef}}：心理師為 {{therapistName}}。" +
    '{{#if (eq variant "EAP")}}本次由 EAP 支付。{{else}}請自費。{{/if}}';

  it("substitutes fields and picks the matching variant block", () => {
    const result = renderLetter({
      templateBody,
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
      variant: "EAP",
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。本次由 EAP 支付。");
  });

  it("falls back to the shared block for a non-matching variant", () => {
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
});
