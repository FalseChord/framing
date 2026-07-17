import { describe, it, expect } from "vitest";
import { encodeRequiredFields, decodeRequiredFields } from "./requiredFields";

describe("requiredFields JSON codec", () => {
  it("round-trips an array of field names through encode then decode", () => {
    const fields = ["caseRef", "therapistName", "sessionDate"];
    expect(decodeRequiredFields(encodeRequiredFields(fields))).toEqual(fields);
  });

  it("encodes an empty array as the literal string '[]'", () => {
    expect(encodeRequiredFields([])).toBe("[]");
  });

  it("decodes '[]' as an empty array", () => {
    expect(decodeRequiredFields("[]")).toEqual([]);
  });

  it("throws a clear error when the stored JSON is not an array", () => {
    expect(() => decodeRequiredFields('{"not":"an array"}')).toThrowError(/預期為陣列/);
  });
});
