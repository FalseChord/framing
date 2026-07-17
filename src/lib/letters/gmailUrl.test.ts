import { describe, it, expect } from "vitest";
import { buildGmailComposeUrl } from "./gmailUrl";

describe("buildGmailComposeUrl", () => {
  it("round-trips recipient, subject, and multi-line body through the URL unchanged", () => {
    const url = buildGmailComposeUrl({
      to: "case@example.com",
      subject: "媒合通知",
      body: "第一行\n第二行",
    });

    expect(url.startsWith("https://mail.google.com/mail/?")).toBe(true);

    const params = new URL(url).searchParams;
    expect(params.get("view")).toBe("cm");
    expect(params.get("fs")).toBe("1");
    expect(params.get("to")).toBe("case@example.com");
    expect(params.get("su")).toBe("媒合通知");
    expect(params.get("body")).toBe("第一行\n第二行");
  });
});
