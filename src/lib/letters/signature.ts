export interface SignatureOptions {
  operatorSignature: string;
  includeLine: boolean;
}

const LINE_CONTACT_LINE = "也可以加我們的官方LINE做聯繫：@775jyvbp";

export function buildSignatureBlock(options: SignatureOptions): string {
  const lines = ["如果有其他需協助的地方歡迎和我們聯繫，謝謝！"];
  if (options.includeLine) {
    lines.push(LINE_CONTACT_LINE);
  }
  // Blank line between the closing remark(s) and 敬祝, as in the clinic's letters.
  lines.push("", "敬祝　平安順心", `加惠行政團隊 ${options.operatorSignature}`);
  return lines.join("\n");
}
