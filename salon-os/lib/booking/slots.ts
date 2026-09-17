import { DateTime, Interval } from "luxon";

/**
 * Slot generation.
 *
 * This is a PURE function. `now` is injected rather than read from the clock, so
 * every edge case — DST, lead time, a fully booked day — is testable without
 * mocking time. That single design choice is why the DST tests below can exist.
 *
 * All wall-clock arithmetic happens in the tenant's IANA timezone. The salon opens
 * at 9am *local*, which is a different UTC instant in June than in January; storing
 * a fixed offset instead of a zone name breaks twice a year.
 */

export type AvailabilityRule = {
  weekday: number; // 0 = Sunday
  startTime: string; // 'HH:mm' wall clock in the tenant's zone
  endTime: string;
};

export type AvailabilityException = {
  onDate: string; // 'YYYY-MM-DD'
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
};

export type BusyInterval = {
  blockedStartsAt: string; // ISO instant
  blockedEndsAt: string;
};

export type SlotServiceSpec = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type GenerateSlotsInput = {
  tenantTz: string;
  date: string; // 'YYYY-MM-DD' in the tenant's zone
  service: SlotServiceSpec;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  busy: BusyInterval[];
  now: Date;
  minLeadMinutes?: number;
  granularityMinutes?: number;
};

export type Slot = {
  /** What the customer sees. */
  startsAt: string;
  endsAt: string;
  /** What actually reserves the stylist, buffers included. Sent to the booking action. */
  blockedStartsAt: string;
  blockedEndsAt: string;
};

const DEFAULT_LEAD_MINUTES = 120;
const DEFAULT_GRANULARITY = 15;

/**
 * POLICY: the full blocked range (buffers included) must fit inside working hours.
 *
 * A stylist who closes at 5pm and needs 15 minutes to clean up finishes their last
 * 4-hour service at 4:45, not 5:00. Relaxing this means the last client of the day
 * routinely runs the stylist late — a scheduling bug that shows up as burnout rather
 * than an error message.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const {
    tenantTz,
    date,
    service,
    rules,
    exceptions,
    busy,
    now,
    minLeadMinutes = DEFAULT_LEAD_MINUTES,
    granularityMinutes = DEFAULT_GRANULARITY,
  } = input;

  const windows = resolveWindows({ tenantTz, date, rules, exceptions });
  if (windows.length === 0) return [];

  const earliestStart = DateTime.fromJSDate(now, { zone: tenantTz }).plus({
    minutes: minLeadMinutes,
  });

  const busyIntervals = busy
    .map((b) =>
      Interval.fromDateTimes(
        DateTime.fromISO(b.blockedStartsAt, { zone: tenantTz }),
        DateTime.fromISO(b.blockedEndsAt, { zone: tenantTz }),
      ),
    )
    .filter((i) => i.isValid);

  const slots: Slot[] = [];

  for (const window of windows) {
    // Walk the grid from the window start. Adding minutes to a zoned DateTime is
    // DST-correct: Luxon crosses the offset change rather than producing a phantom
    // wall-clock time that never existed.
    let cursor = window.start;

    while (cursor < window.end) {
      const blockedStart = cursor;
      const start = blockedStart.plus({ minutes: service.bufferBeforeMinutes });
      const end = start.plus({ minutes: service.durationMinutes });
      const blockedEnd = end.plus({ minutes: service.bufferAfterMinutes });

      if (blockedEnd > window.end) break; // nothing later in this window can fit either

      const candidate = Interval.fromDateTimes(blockedStart, blockedEnd);
      const overlapsBusy = busyIntervals.some((b) => b.overlaps(candidate));
      const tooSoon = start < earliestStart;

      if (!overlapsBusy && !tooSoon) {
        slots.push({
          startsAt: start.toUTC().toISO()!,
          endsAt: end.toUTC().toISO()!,
          blockedStartsAt: blockedStart.toUTC().toISO()!,
          blockedEndsAt: blockedEnd.toUTC().toISO()!,
        });
      }

      cursor = cursor.plus({ minutes: granularityMinutes });
    }
  }

  // Multiple windows (a split shift) can interleave; sort by real instant.
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function resolveWindows(args: {
  tenantTz: string;
  date: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}): { start: DateTime; end: DateTime }[] {
  const { tenantTz, date, rules, exceptions } = args;

  const exception = exceptions.find((e) => e.onDate === date);
  if (exception) {
    // A date exception always beats the weekly rule — that is the whole point of it.
    if (exception.isClosed || !exception.startTime || !exception.endTime) return [];
    return buildWindow(tenantTz, date, exception.startTime, exception.endTime);
  }

  const day = DateTime.fromISO(date, { zone: tenantTz });
  if (!day.isValid) return [];
  // Luxon weekday: 1 = Monday .. 7 = Sunday. Ours: 0 = Sunday .. 6 = Saturday.
  const weekday = day.weekday % 7;

  return rules
    .filter((r) => r.weekday === weekday)
    .flatMap((r) => buildWindow(tenantTz, date, r.startTime, r.endTime));
}

function buildWindow(
  tenantTz: string,
  date: string,
  startTime: string,
  endTime: string,
): { start: DateTime; end: DateTime }[] {
  const start = DateTime.fromISO(`${date}T${normalizeTime(startTime)}`, { zone: tenantTz });
  const end = DateTime.fromISO(`${date}T${normalizeTime(endTime)}`, { zone: tenantTz });
  if (!start.isValid || !end.isValid || end <= start) return [];
  return [{ start, end }];
}

/** Postgres hands back 'HH:mm:ss'; forms hand back 'HH:mm'. Accept both. */
function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}
