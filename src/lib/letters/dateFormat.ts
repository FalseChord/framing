const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export interface SessionSlotInput {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  durationMinutes: number; // e.g. 50 (一般) or 80 (伴侶)
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const endHours = Math.floor(total / 60) % 24;
  const endMins = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
}

export function formatSessionSlot(input: SessionSlotInput): string {
  const [, month, day] = input.date.split("-").map(Number);
  const weekday = WEEKDAY_LABELS[new Date(`${input.date}T00:00:00`).getDay()];
  const endTime = addMinutes(input.startTime, input.durationMinutes);
  return `${month}/${day} (${weekday}) ${input.startTime}-${endTime}`;
}

// Payment is due 24 hours after the session *starts* (confirmed with the clinic,
// 2026-11). Same no-year, auto-weekday style as formatSessionSlot.
export function formatPaymentDeadline(input: SessionSlotInput): string {
  const [year, month, day] = input.date.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  const weekday = WEEKDAY_LABELS[next.getDay()];
  return `${next.getMonth() + 1}/${next.getDate()} (${weekday}) ${input.startTime}`;
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
