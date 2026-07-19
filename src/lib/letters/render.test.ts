import { describe, it, expect } from "vitest";
import { renderLetter, MissingFieldsError } from "./render";

describe("renderLetter", () => {
  it("substitutes declared fields into the template body", () => {
    const result = renderLetter({
      templateBody: "親愛的 {{caseRef}}：心理師為 {{therapistName}}。",
      requiredFields: ["caseRef", "therapistName"],
      fields: { caseRef: "A001", therapistName: "王小明" },
    });
    expect(result).toBe("親愛的 A001：心理師為 王小明。");
  });

  it("throws MissingFieldsError listing every empty required field", () => {
    expect(() =>
      renderLetter({
        templateBody: "{{caseRef}} {{therapistName}}",
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "", therapistName: "" },
      })
    ).toThrowError(MissingFieldsError);
  });

  it("lists exactly the missing field names on the thrown error", () => {
    try {
      renderLetter({
        templateBody: "{{caseRef}} {{therapistName}}",
        requiredFields: ["caseRef", "therapistName"],
        fields: { caseRef: "A001", therapistName: "" },
      });
      throw new Error("expected renderLetter to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingFieldsError);
      expect((err as MissingFieldsError).missingFields).toEqual(["therapistName"]);
    }
  });

  it("resolves slot blocks using slotCount", () => {
    const result = renderLetter({
      templateBody: "[單一時段]時間為 {{sessionSlots}}[/單一時段][多個時段]候選時間：{{sessionSlots}}[/多個時段]",
      requiredFields: ["sessionSlots"],
      fields: { sessionSlots: "7/22 (三) 19:00-20:20" },
      slotCount: 1,
    });
    expect(result).toBe("時間為 7/22 (三) 19:00-20:20");
  });
});
