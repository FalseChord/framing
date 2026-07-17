import { describe, it, expect } from "vitest";
import { findUndeclaredFields } from "./templateFields";

describe("findUndeclaredFields", () => {
  it("returns an empty list when every referenced field is declared or standard", () => {
    const body = "{{caseRef}} {{therapistName}} {{sessionDate}}";
    expect(findUndeclaredFields(body, [])).toEqual([]);
  });

  it("flags a field that is neither standard nor in requiredFields", () => {
    const body = "{{caseRef}} {{groupName}}";
    expect(findUndeclaredFields(body, [])).toEqual(["groupName"]);
  });

  it("does not flag a field once it is declared in requiredFields", () => {
    const body = "{{caseRef}} {{groupName}}";
    expect(findUndeclaredFields(body, ["groupName"])).toEqual([]);
  });

  it("ignores Handlebars block helpers like #if/else/variant", () => {
    const body = '{{#if (eq variant "EAP")}}{{caseRef}}{{else}}{{caseRef}}{{/if}}';
    expect(findUndeclaredFields(body, [])).toEqual([]);
  });
});
