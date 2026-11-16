import { describe, it, expect } from "vitest";
import { generateLetter } from "./generateLetter";
import { MissingFieldsError } from "./render";

const template = {
  subject: "**{{caseRef}}** 的媒合通知",
  body: "親愛的 {{caseRef}}：心理師為 **{{therapistName}}**。",
  requiredFields: ["caseRef", "therapistName"],
};

describe("generateLetter", () => {
  it("renders subject without highlight markers", () => {
    const result = generateLetter({
      template,
      fields: { caseRef: "王先生", therapistName: "李心理師" },
      includeLine: false,
      operatorSignature: "S01",
    });
    expect(result.renderedSubject).toBe("王先生 的媒合通知");
  });

  it("appends the signature block with the operator code to the body", () => {
    const result = generateLetter({
      template,
      fields: { caseRef: "王先生", therapistName: "李心理師" },
      includeLine: true,
      operatorSignature: "S01",
    });
    expect(result.renderedBodyPlain).toContain("親愛的 王先生：心理師為 李心理師。");
    expect(result.renderedBodyPlain).toContain("加惠行政團隊 S01");
    expect(result.renderedBodyPlain).toContain("官方LINE");
    expect(result.renderedBodyHtml).toContain("<b");
  });

  it("throws MissingFieldsError when a required field is empty", () => {
    expect(() =>
      generateLetter({
        template,
        fields: { caseRef: "王先生", therapistName: "" },
        includeLine: false,
        operatorSignature: "S01",
      })
    ).toThrowError(MissingFieldsError);
  });
});
