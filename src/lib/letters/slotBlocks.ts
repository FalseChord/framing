const SINGLE_BLOCK = /\[單一時段\]([\s\S]*?)\[\/單一時段\]/g;
const MULTI_BLOCK = /\[多個時段\]([\s\S]*?)\[\/多個時段\]/g;

export function resolveSlotBlocks(text: string, slotCount: number): string {
  let result = text.replace(SINGLE_BLOCK, (_match, inner: string) => (slotCount === 1 ? inner : ""));
  result = result.replace(MULTI_BLOCK, (_match, inner: string) => (slotCount >= 2 ? inner : ""));
  return result;
}
