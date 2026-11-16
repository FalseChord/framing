// Also used for Template.optionalFields, which shares the same JSON-array encoding.
export function encodeRequiredFields(fields: string[]): string {
  return JSON.stringify(fields);
}

export function decodeRequiredFields(json: string): string[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error(`必填欄位資料格式錯誤，預期為陣列: ${json}`);
  }
  return parsed;
}
