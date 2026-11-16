import { describe, it, expect } from "vitest";
import { isAuthorized } from "./basicAuth";

function basicHeader(user: string, password: string): string {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

describe("isAuthorized", () => {
  it("accepts the correct password regardless of username", () => {
    expect(isAuthorized(basicHeader("", "letters-2026"), "letters-2026")).toBe(true);
    expect(isAuthorized(basicHeader("anyone", "letters-2026"), "letters-2026")).toBe(true);
  });

  it("accepts a password containing a colon", () => {
    expect(isAuthorized(basicHeader("x", "a:b"), "a:b")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(isAuthorized(basicHeader("x", "letters-2025"), "letters-2026")).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(isAuthorized(null, "letters-2026")).toBe(false);
    expect(isAuthorized("Bearer abc", "letters-2026")).toBe(false);
    expect(isAuthorized("Basic %%%", "letters-2026")).toBe(false);
  });

  it("fails closed when no password is configured", () => {
    expect(isAuthorized(basicHeader("x", ""), "")).toBe(false);
  });
});
