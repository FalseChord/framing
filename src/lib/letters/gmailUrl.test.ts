import { describe, it, expect } from "vitest";
import { buildGmailComposeUrl } from "./gmailUrl";

describe("buildGmailComposeUrl", () => {
  it("includes to, bcc, and subject when all are provided", () => {
    const url = buildGmailComposeUrl({
      to: "case@example.com",
      bcc: "internal@example.com",
      subject: "媒合通知",
    });
    const params = new URL(url).searchParams;
    expect(params.get("to")).toBe("case@example.com");
    expect(params.get("bcc")).toBe("internal@example.com");
    expect(params.get("su")).toBe("媒合通知");
  });

  it("omits the to param when no recipient is given (BCC-only case)", () => {
    const url = buildGmailComposeUrl({ bcc: "internal@example.com", subject: "主旨" });
    const params = new URL(url).searchParams;
    expect(params.has("to")).toBe(false);
    expect(params.get("bcc")).toBe("internal@example.com");
  });

  it("joins multiple recipients as a comma-separated to param", () => {
    const url = buildGmailComposeUrl({ to: "a@example.com,b@example.com", subject: "主旨" });
    expect(new URL(url).searchParams.get("to")).toBe("a@example.com,b@example.com");
  });

  it("omits the body param when no body is given", () => {
    const url = buildGmailComposeUrl({ to: "a@example.com", subject: "主旨" });
    expect(new URL(url).searchParams.has("body")).toBe(false);
  });
});
