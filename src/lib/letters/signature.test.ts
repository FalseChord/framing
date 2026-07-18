import { describe, it, expect } from "vitest";
import { buildSignatureBlock } from "./signature";

describe("buildSignatureBlock", () => {
  it("builds the base signature block with the operator's code, no LINE line by default", () => {
    const result = buildSignatureBlock({ operatorSignature: "TA", includeLine: false });
    expect(result).toBe("如果有其他需協助的地方歡迎和我們聯繫，謝謝！\n敬祝　平安順心\n加惠行政團隊 TA");
  });

  it("includes the LINE contact line when requested", () => {
    const result = buildSignatureBlock({ operatorSignature: "TA", includeLine: true });
    expect(result).toBe(
      "如果有其他需協助的地方歡迎和我們聯繫，謝謝！\n(可選)也可以加我們的官方LINE做聯繫：@775jyvbp\n敬祝　平安順心\n加惠行政團隊 TA"
    );
  });
});
