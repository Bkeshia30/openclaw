import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Client } from "pg";
import { DateTime } from "luxon";
import { resetSchema, connect, seedTenant, type Seed } from "../setup/db";

/**
 * The claim under test: double-booking is structurally impossible.
 *
 * Not "unlikely". Not "handled in the booking service". Impossible, because the
 * database refuses the write. These tests fire genuinely simultaneous requests on
 * separate connections — a sequential loop would pass even with a broken design.
 */

/**
 * Always a real future instant. Hardcoding "2025-06-03" made these tests pass in
 * 2025 and fail in 2026 — a fixture that expires is a test that lies about when
 * it broke. Anchored to a Tuesday so it lands inside the seeded Mon–Fri hours.
 */
function futureSlot(hourLocal = 14, plusDays = 0): string {
  let d = DateTime.now().setZone("America/New_York").plus({ weeks: 2 }).startOf("day");
  while (d.weekday !== 2) d = d.plus({ days: 1 }); // 2 = Tuesday
  return d.plus({ days: plusDays }).set({ hour: hourLocal }).toISO()!;
}

const SLOT = futureSlot();
let main: Client;
let seed: Seed;

beforeAll(async () => {
  await resetSchema();
  main = connect();
  await main.connect();
});

beforeEach(async () => {
  await main.query("truncate appointments, events, contacts, staff_services, availability_rules, services, staff, profiles, tenants cascade");
  await main.query("delete from auth.users");
  seed = await seedTenant(main, { slug: "kesh" });
});

afterAll(async () => { await main.end(); });

function book(c: Client, seed: Seed, over: Partial<{ email: string; startsAt: string; serviceId: string; staffId: string }> = {}) {
  return c.query(
    `select book_appointment($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11) as id`,
    [
      seed.tenantSlug,
      over.serviceId ?? seed.serviceId,
      over.staffId ?? seed.staffId,
      over.startsAt ?? SLOT,
      "Test", "Client",
      over.email ?? "one@example.com",
      "+15555550100",
      null, true, true,
    ],
  );
}

describe("booking under concurrency", () => {
  it("20 simultaneous requests for one slot: exactly one wins", async () => {
    const N = 20;
    // Connect everyone FIRST so no request is slowed by its own handshake —
    // otherwise they arrive staggered and the race never actually happens.
    const clients = await Promise.all(
      Array.from({ length: N }, async () => { const c = connect(); await c.connect(); return c; }),
    );

    try {
      const results = await Promise.allSettled(
        clients.map((c, i) => book(c, seed, { email: `racer${i}@example.com` })),
      );

      const won = results.filter((r) => r.status === "fulfilled");
      const lost = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(N - 1);

      // Every loser must fail for the RIGHT reason: exclusion_violation. If any
      // failed with something else, we have a different bug wearing this one's coat.
      for (const l of lost) expect(l.reason.code).toBe("23P01");

      const { rows } = await main.query(
        `select count(*)::int as n from appointments where status in ('pending','confirmed')`,
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });

  it("a losing booking leaves no orphan contact behind", async () => {
    await book(main, seed, { email: "first@example.com" });
    await expect(book(main, seed, { email: "second@example.com" })).rejects.toMatchObject({ code: "23P01" });

    // The whole function rolled back, so the loser's contact was never created.
    const { rows } = await main.query(`select email from contacts order by email`);
    expect(rows.map((r) => r.email)).toEqual(["first@example.com"]);
  });

  it("overlapping — not just identical — times are rejected", async () => {
    await book(main, seed); // 14:00, 120 min + 15 min buffer => blocked to 16:15
    await expect(book(main, seed, { email: "b@example.com", startsAt: futureSlot(15) }))
      .rejects.toMatchObject({ code: "23P01" });
  });

  it("the after-buffer reserves time, not just the appointment", async () => {
    await book(main, seed); // blocked until 16:15
    await expect(book(main, seed, { email: "b@example.com", startsAt: futureSlot(16) }))
      .rejects.toMatchObject({ code: "23P01" });
    // 16:15 is the first genuinely free start.
    await expect(book(main, seed, { email: "c@example.com", startsAt: DateTime.fromISO(futureSlot(16)).plus({ minutes: 15 }).toISO()! }))
      .resolves.toBeDefined();
  });

  it("cancelling frees the slot for someone else", async () => {
    const { rows: [first] } = await book(main, seed);
    await main.query("select cancel_appointment($1, 'client rescheduled')", [first.id]);
    await expect(book(main, seed, { email: "b@example.com" })).resolves.toBeDefined();
  });

  it("the same person booking twice reuses their contact row", async () => {
    await book(main, seed);
    await book(main, seed, { startsAt: futureSlot(14, 1) });
    const { rows } = await main.query(`select count(*)::int as n from contacts`);
    expect(rows[0].n).toBe(1);
  });
});

describe("booking input is never trusted", () => {
  it("charges the database price, not anything the caller could send", async () => {
    // The function has no price parameter at all — the caller cannot express a price.
    const { rows: [appt] } = await book(main, seed);
    const { rows } = await main.query(
      `select a.price_cents, a.deposit_due_cents, s.price_cents as svc
         from appointments a join services s on s.id = a.service_id where a.id = $1`,
      [appt.id],
    );
    expect(rows[0].price_cents).toBe("12000");
    expect(rows[0].deposit_due_cents).toBe("3000");
    expect(rows[0].price_cents).toBe(rows[0].svc);
  });

  it("rejects another tenant's service id", async () => {
    const other = await seedTenant(main, { slug: "other" });
    await expect(book(main, seed, { serviceId: other.serviceId }))
      .rejects.toThrow(/unknown or inactive service/);
  });

  it("rejects a stylist who does not offer the service", async () => {
    const { rows: [stranger] } = await main.query(
      `insert into staff (tenant_id, display_name) values ($1, 'Stranger') returning id`,
      [seed.tenantId],
    );
    await expect(book(main, seed, { staffId: stranger.id }))
      .rejects.toThrow(/does not offer this service/);
  });

  it("rejects a time in the past", async () => {
    await expect(book(main, seed, { startsAt: "2020-01-01T10:00:00-05:00" /* genuinely past */ }))
      .rejects.toThrow(/cannot book a time in the past/);
  });

  it("emits exactly one appointment.created event per booking", async () => {
    await book(main, seed);
    const { rows } = await main.query(
      `select count(*)::int as n from events where type = 'appointment.created'`,
    );
    expect(rows[0].n).toBe(1);
  });
});
