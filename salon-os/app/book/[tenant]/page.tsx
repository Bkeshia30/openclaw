import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { createAdminClient } from "@/lib/db/server";
import { generateSlots } from "@/lib/booking/slots";
import { formatMoney } from "@/lib/money";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

// Hand-written row types. Day 3's follow-up is `supabase gen types typescript`,
// which generates these from the live schema so a migration that renames a column
// becomes a compile error instead of a runtime one.
type ServiceRow = {
  id: string; name: string; description: string | null;
  duration_minutes: number; buffer_before_minutes: number; buffer_after_minutes: number;
  price_cents: number; deposit_cents: number;
};
type RuleRow = { weekday: number; start_time: string; end_time: string };
type ExceptionRow = { on_date: string; is_closed: boolean; start_time: string | null; end_time: string | null };
type BusyRow = { blocked_starts_at: string; blocked_ends_at: string };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { tenant: string };
  searchParams: { service?: string; date?: string };
}) {
  const db = createAdminClient();

  const { data: tenant } = await db
    .from("tenants").select("id, name, slug, timezone").eq("slug", params.tenant).maybeSingle();
  if (!tenant) notFound();

  const { data: services } = await db
    .from("services")
    .select("id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_cents, deposit_cents")
    .eq("tenant_id", tenant.id).eq("active", true).order("name");

  const service = services?.find((s: ServiceRow) => s.id === searchParams.service) ?? services?.[0];
  const date = searchParams.date ?? DateTime.now().setZone(tenant.timezone).toISODate()!;

  let slots: Awaited<ReturnType<typeof loadSlots>> = { slots: [], staffId: null };
  if (service) slots = await loadSlots(db, tenant, service, date);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">{tenant.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">Book in about a minute.</p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Service</h2>
        <div className="mt-2 space-y-2">
          {(services ?? []).map((s: ServiceRow) => (
            <a
              key={s.id}
              href={`/book/${tenant.slug}?service=${s.id}&date=${date}`}
              className={`block rounded-lg border p-3 ${
                s.id === service?.id
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{s.name}</span>
                <span>{formatMoney(s.price_cents)}</span>
              </div>
              <p className="text-sm text-neutral-500">
                {s.duration_minutes} min
                {s.deposit_cents > 0 && ` · ${formatMoney(s.deposit_cents)} deposit`}
              </p>
            </a>
          ))}
          {(services ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">No services are bookable yet.</p>
          )}
        </div>
      </section>

      {service && (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Date</h2>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 14 }, (_, i) => {
                const d = DateTime.now().setZone(tenant.timezone).plus({ days: i });
                const iso = d.toISODate()!;
                return (
                  <a
                    key={iso}
                    href={`/book/${tenant.slug}?service=${service.id}&date=${iso}`}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-center text-sm ${
                      iso === date ? "border-neutral-900 dark:border-white" : "border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <div className="text-xs text-neutral-500">{d.toFormat("ccc")}</div>
                    <div>{d.toFormat("d LLL")}</div>
                  </a>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Time</h2>
            {slots.slots.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">Nothing available that day. Try another date.</p>
            ) : (
              <BookingForm
                tenantSlug={tenant.slug}
                tenantTz={tenant.timezone}
                serviceId={service.id}
                staffId={slots.staffId!}
                depositCents={service.deposit_cents}
                slots={slots.slots}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}

async function loadSlots(
  db: ReturnType<typeof createAdminClient>,
  tenant: { id: string; timezone: string },
  service: {
    id: string; duration_minutes: number;
    buffer_before_minutes: number; buffer_after_minutes: number;
  },
  date: string,
) {
  // v1 books the first staff member who offers this service. Day 11 extends this
  // to "any stylist" vs. a named one; the slot generator already takes a staffId.
  const { data: staffRows } = await db
    .from("staff_services").select("staff_id, staff!inner(id, active)")
    .eq("service_id", service.id).eq("staff.active", true).limit(1);

  const staffId = (staffRows?.[0] as any)?.staff_id as string | undefined;
  if (!staffId) return { slots: [], staffId: null };

  const dayStart = DateTime.fromISO(date, { zone: tenant.timezone }).startOf("day");

  const [{ data: rules }, { data: exceptions }, { data: busy }] = await Promise.all([
    db.from("availability_rules").select("weekday, start_time, end_time").eq("staff_id", staffId),
    db.from("availability_exceptions").select("on_date, is_closed, start_time, end_time").eq("staff_id", staffId),
    db.from("appointments")
      .select("blocked_starts_at, blocked_ends_at")
      .eq("staff_id", staffId)
      .in("status", ["pending", "confirmed"])
      .gte("blocked_starts_at", dayStart.minus({ days: 1 }).toISO()!)
      .lte("blocked_starts_at", dayStart.plus({ days: 2 }).toISO()!),
  ]);

  const slots = generateSlots({
    tenantTz: tenant.timezone,
    date,
    service: {
      durationMinutes: service.duration_minutes,
      bufferBeforeMinutes: service.buffer_before_minutes,
      bufferAfterMinutes: service.buffer_after_minutes,
    },
    rules: (rules ?? []).map((r: RuleRow) => ({ weekday: r.weekday, startTime: r.start_time, endTime: r.end_time })),
    exceptions: (exceptions ?? []).map((e: ExceptionRow) => ({
      onDate: e.on_date, isClosed: e.is_closed, startTime: e.start_time, endTime: e.end_time,
    })),
    busy: (busy ?? []).map((b: BusyRow) => ({ blockedStartsAt: b.blocked_starts_at, blockedEndsAt: b.blocked_ends_at })),
    now: new Date(),
  });

  return { slots, staffId };
}
