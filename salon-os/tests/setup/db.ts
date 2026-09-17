import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:55432/salon_test";

export function connect() {
  return new Client({ connectionString: TEST_DATABASE_URL });
}

/**
 * Rebuilds the database from the shim + every migration, in order.
 *
 * This is also a standing test of the migrations themselves: if a migration stops
 * being replayable from scratch, every test in the suite fails immediately.
 */
export async function resetSchema(): Promise<void> {
  const c = connect();
  await c.connect();
  try {
    await c.query("drop schema if exists public cascade");
    await c.query("drop schema if exists auth cascade");
    await c.query("create schema public");

    const files = [
      join(root, "tests", "setup", "0000_local_shim.sql"),
      ...readdirSync(join(root, "supabase", "migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => join(root, "supabase", "migrations", f)),
    ];
    for (const f of files) await c.query(readFileSync(f, "utf8"));
  } finally {
    await c.end();
  }
}

export type Seed = {
  tenantId: string;
  tenantSlug: string;
  staffId: string;
  serviceId: string;
  userId: string;
};

export async function seedTenant(
  c: Client,
  opts: { slug: string; tz?: string; durationMinutes?: number; bufferAfter?: number },
): Promise<Seed> {
  const { rows: [tenant] } = await c.query(
    `insert into tenants (name, slug, timezone) values ($1, $2, $3) returning id`,
    [`Salon ${opts.slug}`, opts.slug, opts.tz ?? "America/New_York"],
  );
  const { rows: [user] } = await c.query(
    `insert into auth.users (email) values ($1) returning id`,
    [`owner@${opts.slug}.test`],
  );
  await c.query(
    `insert into profiles (id, tenant_id, role, full_name) values ($1, $2, 'owner', $3)`,
    [user.id, tenant.id, `Owner ${opts.slug}`],
  );
  const { rows: [service] } = await c.query(
    `insert into services (tenant_id, name, duration_minutes, buffer_after_minutes, price_cents, deposit_cents)
     values ($1, 'Loc Retwist', $2, $3, 12000, 3000) returning id`,
    [tenant.id, opts.durationMinutes ?? 120, opts.bufferAfter ?? 15],
  );
  const { rows: [staffRow] } = await c.query(
    `insert into staff (tenant_id, display_name) values ($1, 'Kesh') returning id`,
    [tenant.id],
  );
  await c.query(
    `insert into staff_services (tenant_id, staff_id, service_id) values ($1, $2, $3)`,
    [tenant.id, staffRow.id, service.id],
  );
  await c.query(
    `insert into availability_rules (tenant_id, staff_id, weekday, start_time, end_time)
     select $1, $2, g, '09:00', '18:00' from generate_series(1, 5) g`,
    [tenant.id, staffRow.id],
  );
  return {
    tenantId: tenant.id,
    tenantSlug: opts.slug,
    staffId: staffRow.id,
    serviceId: service.id,
    userId: user.id,
  };
}

/** Run a callback as an authenticated end user, so RLS policies actually apply. */
export async function asUser<T>(c: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  try {
    // SET ROLE drops superuser (and with it BYPASSRLS) for the rest of the transaction.
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await fn();
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}
