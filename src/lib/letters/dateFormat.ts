const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export interface SessionSlotInput {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export function formatSessionSlot(input: SessionSlotInput): string {
  const [, month, day] = input.date.split("-").map(Number);
  const weekday = WEEKDAY_LABELS[new Date(`${input.date}T00:00:00`).getDay()];
  return `${month}/${day} (${weekday}) ${input.startTime}-${input.endTime}`;
}

export function formatSessionSlots(inputs: SessionSlotInput[]): { text: string; count: number } {
  const count = inputs.length;
  if (count === 0) {
    return { text: "", count: 0 };
  }
  if (count === 1) {
    return { text: formatSessionSlot(inputs[0]), count: 1 };
  }
  return { text: inputs.map((slot) => `◉ ${formatSessionSlot(slot)}`).join("\n"), count };
}
