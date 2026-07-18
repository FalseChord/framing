import { describe, it, expect } from "vitest";
import { formatSessionSlot, formatSessionSlots } from "./dateFormat";

describe("formatSessionSlot", () => {
  it("formats date+time range with computed weekday, no year", () => {
    // 2026-07-22 is a Wednesday
    const result = formatSessionSlot({ date: "2026-07-22", startTime: "19:00", endTime: "20:20" });
    expect(result).toBe("7/22 (三) 19:00-20:20");
  });

  it("computes a different weekday correctly", () => {
    // 2026-02-12 is a Thursday
    const result = formatSessionSlot({ date: "2026-02-12", startTime: "19:30", endTime: "20:20" });
    expect(result).toBe("2/12 (四) 19:30-20:20");
  });
});

describe("formatSessionSlots", () => {
  it("returns a single inline string and count 1 for one slot", () => {
    const result = formatSessionSlots([{ date: "2026-07-22", startTime: "19:00", endTime: "20:20" }]);
    expect(result).toEqual({ text: "7/22 (三) 19:00-20:20", count: 1 });
  });

  it("returns a bulleted list and count for two or more slots", () => {
    // 2026-02-12 Thursday, 2026-02-24 Tuesday
    const result = formatSessionSlots([
      { date: "2026-02-12", startTime: "19:30", endTime: "20:20" },
      { date: "2026-02-24", startTime: "19:30", endTime: "20:20" },
    ]);
    expect(result.count).toBe(2);
    expect(result.text).toBe("◉ 2/12 (四) 19:30-20:20\n◉ 2/24 (二) 19:30-20:20");
  });

  it("returns empty text and count 0 for no slots", () => {
    expect(formatSessionSlots([])).toEqual({ text: "", count: 0 });
  });
});
