import { describe, expect, it } from "vitest";
import {
  addDays,
  buildCalendarMonth,
  daysBetween,
  findOnThisDay,
  formatTime,
  groupTimeline,
  isValidDateString,
  localPartsIn,
  mealTimeOf,
  shiftMonth,
} from "../dates";
import { memory } from "./fixtures";

describe("date primitives", () => {
  it("validates real calendar dates", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("26-1-1")).toBe(false);
  });
  it("does day arithmetic across month and year edges", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-09-01", "2026-09-23")).toBe(22);
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
  it("formats times and classifies meal time", () => {
    expect(formatTime("20:42")).toBe("8:42 PM");
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(mealTimeOf("01:30")).toBe("late-night");
    expect(mealTimeOf("09:00")).toBe("breakfast");
    expect(mealTimeOf("13:00")).toBe("lunch");
    expect(mealTimeOf("20:42")).toBe("dinner");
    expect(mealTimeOf(null)).toBeNull();
  });
  it("computes today in a timezone", () => {
    const utcLateEvening = new Date("2026-09-22T20:00:00Z");
    expect(localPartsIn("Asia/Kolkata", utcLateEvening)).toEqual({ date: "2026-09-23", time: "01:30" });
  });
});

describe("groupTimeline", () => {
  it("groups sparse years by year and dense years by month", () => {
    const dense = Array.from({ length: 8 }, (_, i) => memory({ eatenOn: `2026-0${(i % 2) + 8}-1${i}` }));
    const sparse = [memory({ eatenOn: "2024-03-01" }), memory({ eatenOn: "2024-11-05" })];
    const groups = groupTimeline([...sparse, ...dense]);
    expect(groups.map((g) => g.key)).toEqual(["2026-09", "2026-08", "2024"]);
    expect(groups[2].kind).toBe("year");
    expect(groups[2].days.map((d) => d.date)).toEqual(["2024-11-05", "2024-03-01"]);
  });
  it("puts several meals on one day under one day entry, latest first", () => {
    const groups = groupTimeline([
      memory({ id: "x", eatenOn: "2026-09-23", eatenAt: "09:00" }),
      memory({ id: "y", eatenOn: "2026-09-23", eatenAt: "21:00" }),
    ]);
    expect(groups[0].days).toHaveLength(1);
    expect(groups[0].days[0].items.map((i) => i.id)).toEqual(["y", "x"]);
  });
});

describe("buildCalendarMonth", () => {
  it("starts weeks on Monday and carries counts", () => {
    // September 2026 starts on a Tuesday.
    const weeks = buildCalendarMonth(2026, 9, new Map([["2026-09-23", 2]]));
    expect(weeks[0][0].date).toBeNull();
    expect(weeks[0][1].date).toBe("2026-09-01");
    expect(weeks.flat().find((c) => c.date === "2026-09-23")?.count).toBe(2);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe("findOnThisDay", () => {
  it("prefers the same date in earlier years", () => {
    const res = findOnThisDay(
      [memory({ id: "y1", eatenOn: "2025-09-23" }), memory({ id: "y2", eatenOn: "2024-09-23" }), memory({ id: "m1", eatenOn: "2026-08-23" })],
      "2026-09-23",
    );
    expect(res.map((r) => r.label)).toEqual(["1 year ago", "2 years ago"]);
    expect(res[0].items[0].id).toBe("y1");
  });
  it("falls back to the same day in earlier months", () => {
    const res = findOnThisDay([memory({ id: "m1", eatenOn: "2026-06-23" })], "2026-09-23");
    expect(res).toEqual([expect.objectContaining({ kind: "months", label: "3 months ago" })]);
  });
  it("falls back to nearby dates in earlier years", () => {
    const res = findOnThisDay([memory({ id: "n", eatenOn: "2025-09-21" })], "2026-09-23");
    expect(res[0]).toMatchObject({ kind: "nearby", label: "Around this week, 1 year ago" });
  });
  it("returns nothing rather than a fake memory", () => {
    expect(findOnThisDay([memory({ eatenOn: "2026-09-22" })], "2026-09-23")).toEqual([]);
    expect(findOnThisDay([], "2026-09-23")).toEqual([]);
  });
  it("shows Feb 29 memories on Feb 28 in non-leap years", () => {
    const res = findOnThisDay([memory({ eatenOn: "2024-02-29" })], "2027-02-28");
    expect(res[0].label).toBe("3 years ago");
  });
});
