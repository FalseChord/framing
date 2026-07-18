const ONLY_BLOCK = /\[只有\s*([^\]]+)\]([\s\S]*?)\[\/只有\]/g;
const EXCEPT_BLOCK = /\[除外\s*([^\]]+)\]([\s\S]*?)\[\/除外\]/g;

function parseVariantList(raw: string): string[] {
  return raw
    .split(/[、,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function resolveVariantBlocks(text: string, variant: string): string {
  let result = text.replace(ONLY_BLOCK, (_match, variantsRaw: string, inner: string) => {
    const variants = parseVariantList(variantsRaw);
    return variants.includes(variant) ? inner : "";
  });
  result = result.replace(EXCEPT_BLOCK, (_match, variantsRaw: string, inner: string) => {
    const variants = parseVariantList(variantsRaw);
    return variants.includes(variant) ? "" : inner;
  });
  return result;
}
