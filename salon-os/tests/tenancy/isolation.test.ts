import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { resetSchema, connect, seedTenant, asUser, type Seed } from "../setup/db";

/**
 * Day 6. This suite runs for the rest of the build, on every push.
 *
 * It is the one that catches the RLS policy you forget on the table you add in
 * week four. Isolation is not something you verify once — it is something you
 * re-prove every time the schema changes.
 */

let c: Client;
let alpha: Seed;
let beta: Seed;

beforeAll(async () => {
  await resetSchema();
  c = connect();
  await c.connect();
  alpha = await seedTenant(c, { slug: "alpha" });
  beta = await seedTenant(c, { slug: "beta" });
  // A contact that belongs to alpha and must stay invisible to beta.
  await c.query(
    `insert into contacts (tenant_id, first_name, email) values ($1, 'Alpha Client', 'secret@alpha.test')`,
    [alpha.tenantId],
  );
});

afterAll(async () => { await c.end(); });

describe("structural guarantees", () => {
  it("every table in public has RLS enabled, forced, and a policy", async () => {
    const { rows } = await c.query(`select * from assert_rls_everywhere()`);
    // A new table added without RLS shows up here — which is the entire point.
    expect(rows).toEqual([]);
  });
});

describe("tenant B against tenant A", () => {
  it("cannot read A's contacts", async () => {
    const rows = await asUser(c, beta.userId, async () => {
      const r = await c.query(`select id, email from contacts`);
      return r.rows;
    });
    expect(rows).toEqual([]);
  });

  it("cannot read A's contact even knowing the exact id", async () => {
    const { rows: [target] } = await c.query(`select id from contacts where email = 'secret@alpha.test'`);
    const rows = await asUser(c, beta.userId, async () => {
      const r = await c.query(`select id from contacts where id = $1`, [target.id]);
      return r.rows;
    });
    // Zero rows, not an error. B learns nothing about whether that id exists.
    expect(rows).toEqual([]);
  });

  it("cannot forge a row into A's tenant", async () => {
    await expect(
      asUser(c, beta.userId, () =>
        c.query(`insert into contacts (tenant_id, first_name) values ($1, 'forged')`, [alpha.tenantId]),
      ),
    ).rejects.toMatchObject({ code: "42501" }); // WITH CHECK rejects it
  });

  it("cannot update A's contact", async () => {
    const updated = await asUser(c, beta.userId, async () => {
      const r = await c.query(`update contacts set first_name = 'hacked' where email = 'secret@alpha.test'`);
      return r.rowCount;
    });
    expect(updated).toBe(0);
    const { rows } = await c.query(`select first_name from contacts where email = 'secret@alpha.test'`);
    expect(rows[0].first_name).toBe("Alpha Client");
  });

  it("cannot delete A's contact", async () => {
    const deleted = await asUser(c, beta.userId, async () => {
      const r = await c.query(`delete from contacts where email = 'secret@alpha.test'`);
      return r.rowCount;
    });
    expect(deleted).toBe(0);
  });

  it("cannot read A's services, staff, appointments or events", async () => {
    const counts = await asUser(c, beta.userId, async () => {
      const out: Record<string, number> = {};
      for (const t of ["services", "staff", "appointments", "events", "availability_rules"]) {
        const r = await c.query(`select count(*)::int as n from ${t} where tenant_id = $1`, [alpha.tenantId]);
        out[t] = r.rows[0].n;
      }
      return out;
    });
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it("sees only its own rows, and A sees only theirs", async () => {
    const betaCount = await asUser(c, beta.userId, async () =>
      (await c.query(`select count(*)::int as n from services`)).rows[0].n);
    const alphaCount = await asUser(c, alpha.userId, async () =>
      (await c.query(`select count(*)::int as n from services`)).rows[0].n);
    expect(betaCount).toBe(1);
    expect(alphaCount).toBe(1);
  });
});

describe("the anon role", () => {
  it("cannot read contacts at all", async () => {
    await c.query("begin");
    await c.query("set local role anon");
    await expect(c.query(`select * from contacts`)).rejects.toMatchObject({ code: "42501" });
    await c.query("rollback");
  });

  it("cannot read appointments at all", async () => {
    await c.query("begin");
    await c.query("set local role anon");
    await expect(c.query(`select * from appointments`)).rejects.toMatchObject({ code: "42501" });
    await c.query("rollback");
  });
});

describe("a session with no profile", () => {
  it("sees nothing rather than everything", async () => {
    // auth_tenant_id() returns null. A policy comparing tenant_id = null matches
    // no rows — the safe direction. Worth proving, because the unsafe direction
    // (null meaning "no filter") is how these bugs usually read.
    const rows = await asUser(c, "00000000-0000-0000-0000-000000000000", async () =>
      (await c.query(`select * from contacts`)).rows);
    expect(rows).toEqual([]);
  });
});
