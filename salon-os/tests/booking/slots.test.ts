import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { generateSlots, type GenerateSlotsInput } from "@/lib/booking/slots";

const TZ = "America/New_York";
const LONG_AGO = new Date("2020-01-01T00:00:00Z"); // lead time never interferes

function input(over: Partial<GenerateSlotsInput> = {}): GenerateSlotsInput {
  return {
    tenantTz: TZ,
    date: "2025-06-02", // a Monday
    service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 15 },
    rules: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }],
    exceptions: [],
    busy: [],
    now: LONG_AGO,
    ...over,
  };
}

const localHour = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).hour;
const localHM = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toFormat("HH:mm");

describe("generateSlots — basics", () => {
  it("fills the day on a 15-minute grid and reserves room for the after-buffer", () => {
    const slots = generateSlots(input());
    expect(localHM(slots[0]!.startsAt)).toBe("09:00");
    // 60m service + 15m cleanup must finish by 17:00, so the last start is 15:45.
    expect(localHM(slots.at(-1)!.startsAt)).toBe("15:45");
    expect(slots).toHaveLength(28);
  });

  it("returns nothing when the service cannot fit in the window", () => {
    const slots = generateSlots(input({ service: { durationMinutes: 600, bufferBeforeMinutes: 0, bufferAfterMinutes: 15 } }));
    expect(slots).toEqual([]);
  });

  it("returns nothing on a weekday with no rule", () => {
    expect(generateSlots(input({ date: "2025-06-01" }))).toEqual([]); // Sunday
  });

  it("offsets the first slot when the service needs setup time", () => {
    const slots = generateSlots(input({
      service: { durationMinutes: 60, bufferBeforeMinutes: 15, bufferAfterMinutes: 15 },
    }));
    // The stylist needs 15 minutes before the client sits down, and the shop
    // opens at 9:00 — so the earliest a client can be seen is 9:15.
    expect(localHM(slots[0]!.startsAt)).toBe("09:15");
  });
});

describe("generateSlots — conflicts and buffers", () => {
  it("blocks the neighbouring slot, not just the appointment itself", () => {
    // Someone is booked 11:00–12:00 with cleanup to 12:15.
    const slots = generateSlots(input({
      busy: [{
        blockedStartsAt: DateTime.fromISO("2025-06-02T11:00", { zone: TZ }).toUTC().toISO()!,
        blockedEndsAt: DateTime.fromISO("2025-06-02T12:15", { zone: TZ }).toUTC().toISO()!,
      }],
    }));
    const starts = slots.map((s) => localHM(s.startsAt));
    expect(starts).not.toContain("11:00");
    expect(starts).not.toContain("10:15"); // would run into the busy block
    expect(starts).not.toContain("12:00"); // would start inside the cleanup buffer
    expect(starts).toContain("12:15");     // first genuinely free start
  });

  it("returns nothing when the day is fully booked", () => {
    const slots = generateSlots(input({
      busy: [{
        blockedStartsAt: DateTime.fromISO("2025-06-02T09:00", { zone: TZ }).toUTC().toISO()!,
        blockedEndsAt: DateTime.fromISO("2025-06-02T17:00", { zone: TZ }).toUTC().toISO()!,
      }],
    }));
    expect(slots).toEqual([]);
  });

  it("honours minimum lead time", () => {
    const slots = generateSlots(input({
      now: DateTime.fromISO("2025-06-02T09:00", { zone: TZ }).toJSDate(),
      minLeadMinutes: 120,
    }));
    expect(localHM(slots[0]!.startsAt)).toBe("11:00");
  });
});

describe("generateSlots — exceptions override rules", () => {
  it("a closed day beats the weekly rule", () => {
    const slots = generateSlots(input({
      exceptions: [{ onDate: "2025-06-02", isClosed: true, startTime: null, endTime: null }],
    }));
    expect(slots).toEqual([]);
  });

  it("modified hours beat the weekly rule", () => {
    const slots = generateSlots(input({
      exceptions: [{ onDate: "2025-06-02", isClosed: false, startTime: "12:00", endTime: "15:00" }],
    }));
    expect(localHM(slots[0]!.startsAt)).toBe("12:00");
    expect(localHM(slots.at(-1)!.startsAt)).toBe("13:45");
  });

  it("an exception on a different date is ignored", () => {
    const slots = generateSlots(input({
      exceptions: [{ onDate: "2025-06-03", isClosed: true, startTime: null, endTime: null }],
    }));
    expect(slots).toHaveLength(28);
  });
});

describe("generateSlots — daylight saving time", () => {
  // 2025-03-09: clocks jump 02:00 -> 03:00. 2025-11-02: 02:00 happens twice.
  it("normal business hours are unaffected by spring-forward", () => {
    const slots = generateSlots(input({
      date: "2025-03-09",
      rules: [{ weekday: 0, startTime: "09:00", endTime: "17:00" }],
    }));
    expect(localHM(slots[0]!.startsAt)).toBe("09:00");
    expect(slots).toHaveLength(28);
  });

  it("never offers a wall-clock time that does not exist", () => {
    const slots = generateSlots(input({
      date: "2025-03-09",
      rules: [{ weekday: 0, startTime: "01:00", endTime: "05:00" }],
      service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
    }));
    expect(slots.length).toBeGreaterThan(0);
    // 02:00–02:59 did not happen on this date. Offering it books a client into a void.
    expect(slots.map((s) => localHour(s.startsAt))).not.toContain(2);
  });

  it("treats the repeated hour as two distinct bookable instants", () => {
    const slots = generateSlots(input({
      date: "2025-11-02",
      rules: [{ weekday: 0, startTime: "00:30", endTime: "03:00" }],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      granularityMinutes: 30,
    }));
    const instants = slots.map((s) => s.startsAt);
    // Same wall clock, different moments — they must not collapse into one another.
    expect(new Set(instants).size).toBe(instants.length);
    // The day is genuinely one hour longer than the same window in June.
    const normal = generateSlots(input({
      date: "2025-06-01",
      rules: [{ weekday: 0, startTime: "00:30", endTime: "03:00" }],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      granularityMinutes: 30,
    }));
    expect(slots.length).toBe(normal.length + 2);
  });
});

describe("generateSlots — split shifts", () => {
  it("handles two windows on one day, sorted by real time", () => {
    const slots = generateSlots(input({
      rules: [
        { weekday: 1, startTime: "09:00", endTime: "12:00" },
        { weekday: 1, startTime: "15:00", endTime: "19:00" },
      ],
    }));
    const starts = slots.map((s) => localHM(s.startsAt));
    expect(starts).toContain("09:00");
    expect(starts).not.toContain("13:00"); // the lunch gap is not bookable
    expect(starts).toContain("15:00");
    expect([...starts]).toEqual([...starts].sort());
  });
});
