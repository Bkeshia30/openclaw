import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { DateTime } from "luxon";
import { resetSchema, connect, seedTenant, type Seed } from "../setup/db";

/**
 * Day 10's lesson, as an executable proof.
 *
 * It is easy to believe the booking function is safe because it "looks careful".
 * This test removes the exclusion constraint, runs the identical race, and shows
 * the same code cheerfully double-booking. Then it puts the constraint back and
 * shows the race resolving correctly.
 *
 * The difference between the two halves is one line of SQL — and it is the only
 * thing standing between you and two clients in one chair.
 */

let main: Client;
let seed: Seed;

const CONSTRAINT = `exclude using gist (staff_id with =, blocked_slot with &&)
                    where (status in ('pending','confirmed'))`;

beforeAll(async () => {
  await resetSchema();
  main = connect();
  await main.connect();
  seed = await seedTenant(main, { slug: "proof" });
});

afterAll(async () => { await main.end(); });

function slot() {
  let d = DateTime.now().setZone("America/New_York").plus({ weeks: 3 }).startOf("day");
  while (d.weekday !== 2) d = d.plus({ days: 1 });
  return d.set({ hour: 11 }).toISO()!;
}

async function race(n: number, startsAt: string) {
  const clients = await Promise.all(
    Array.from({ length: n }, async () => { const c = connect(); await c.connect(); return c; }),
  );
  try {
    return await Promise.allSettled(
      clients.map((c, i) =>
        c.query(`select book_appointment($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11) as id`, [
          seed.tenantSlug, seed.serviceId, seed.staffId, startsAt,
          "Racer", String(i), `proof${i}-${startsAt}@example.com`, null, null, false, false,
        ]),
      ),
    );
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
}

describe("the exclusion constraint is load-bearing", () => {
  it("WITHOUT the constraint, careful-looking code still double-books", async () => {
    await main.query(`alter table appointments drop constraint appointments_no_double_booking`);
    const when = slot();
    try {
      const results = await race(10, when);
      const won = results.filter((r) => r.status === "fulfilled").length;

      // This is the failure mode the constraint exists to prevent.
      expect(won).toBeGreaterThan(1);

      const { rows } = await main.query(
        `select count(*)::int as n from appointments where starts_at = $1::timestamptz
           and status in ('pending','confirmed')`, [when],
      );
      expect(rows[0].n).toBeGreaterThan(1);
    } finally {
      await main.query(`delete from appointments`);
      await main.query(`alter table appointments add constraint appointments_no_double_booking ${CONSTRAINT}`);
    }
  });

  it("WITH the constraint restored, the identical race resolves to exactly one", async () => {
    const when = slot();
    const results = await race(10, when);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const { rows } = await main.query(
      `select count(*)::int as n from appointments where status in ('pending','confirmed')`,
    );
    expect(rows[0].n).toBe(1);
  });
});
