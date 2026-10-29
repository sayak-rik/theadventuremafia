import { describe, it, expect } from "vitest";
import { todayIST, addDaysISO, isValidISODate, diffDaysISO, nowISTParts } from "@/lib/dates";

describe("IST date helpers", () => {
  it("uses India's calendar date, not the server's (UTC) date", () => {
    // 19:00Z on the 12th is already 00:30 IST on the 13th.
    expect(todayIST(new Date("2026-10-12T19:00:00Z"))).toBe("2026-10-13");
    // 18:29Z is still 23:59 IST on the 12th.
    expect(todayIST(new Date("2026-10-12T18:29:00Z"))).toBe("2026-10-12");
  });

  it("reports minutes since midnight in IST", () => {
    expect(nowISTParts(new Date("2026-10-12T04:00:00Z"))).toEqual({ date: "2026-10-12", minutes: 9 * 60 + 30 });
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("validates real calendar dates only", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("26-1-1")).toBe(false);
  });

  it("diffs whole days", () => {
    expect(diffDaysISO("2026-10-12", "2026-10-15")).toBe(3);
    expect(diffDaysISO("2026-10-15", "2026-10-12")).toBe(-3);
  });
});
