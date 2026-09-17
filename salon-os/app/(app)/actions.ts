"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { emit, type EventType } from "@/lib/events/emit";

/**
 * Owner-side actions. These use the SESSION client, not the admin client, so
 * every write is still filtered by RLS — a bug here returns "not found" rather
 * than touching another salon's data.
 */

async function tenantId(db: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await db.from("profiles").select("tenant_id").maybeSingle();
  return (data?.tenant_id as string | undefined) ?? null;
}

const STATUS_EVENT: Record<string, EventType> = {
  confirmed: "appointment.confirmed",
  completed: "appointment.completed",
  cancelled: "appointment.cancelled",
  no_show: "appointment.no_show",
};

export async function setAppointmentStatus(id: string, status: string) {
  const parsed = z.enum(["confirmed", "completed", "cancelled", "no_show"]).safeParse(status);
  if (!parsed.success) return { ok: false as const, message: "Unknown status." };

  const db = createClient();
  const tid = await tenantId(db);
  if (!tid) return { ok: false as const, message: "No salon found for this login." };

  const patch: Record<string, unknown> = { status: parsed.data };
  if (parsed.data === "cancelled") patch.cancelled_at = new Date().toISOString();

  const { data, error } = await db
    .from("appointments").update(patch).eq("id", id).select("id, contact_id").maybeSingle();

  if (error || !data) return { ok: false as const, message: "Could not update that booking." };

  await emit(db, {
    tenantId: tid,
    type: STATUS_EVENT[parsed.data]!,
    contactId: data.contact_id,
    subjectType: "appointment",
    subjectId: id,
    dedupeKey: `${STATUS_EVENT[parsed.data]}:${id}`,
  });

  revalidatePath("/calendar");
  return { ok: true as const };
}

const ServiceInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Give it a name.").max(120),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(480),
  priceCents: z.coerce.number().int().min(0),
  depositCents: z.coerce.number().int().min(0),
  active: z.boolean().default(true),
});

export async function saveService(raw: unknown) {
  const parsed = ServiceInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Check those numbers." };
  }
  const i = parsed.data;
  if (i.depositCents > i.priceCents) {
    return { ok: false as const, message: "The deposit cannot be more than the price." };
  }

  const db = createClient();
  const tid = await tenantId(db);
  if (!tid) return { ok: false as const, message: "No salon found for this login." };

  const row = {
    tenant_id: tid,
    name: i.name,
    duration_minutes: i.durationMinutes,
    buffer_after_minutes: i.bufferAfterMinutes,
    price_cents: i.priceCents,
    deposit_cents: i.depositCents,
    active: i.active,
  };

  const { data, error } = i.id
    ? await db.from("services").update(row).eq("id", i.id).select("id").maybeSingle()
    : await db.from("services").insert(row).select("id").maybeSingle();

  if (error || !data) return { ok: false as const, message: "Could not save that service." };

  // A new service nobody can perform is invisible on the booking page, so attach
  // it to every active stylist. Fine-grained assignment comes later.
  if (!i.id) {
    const { data: staff } = await db.from("staff").select("id").eq("active", true);
    if (staff?.length) {
      await db.from("staff_services").upsert(
        staff.map((s) => ({ tenant_id: tid, staff_id: s.id, service_id: data.id })),
        { onConflict: "staff_id,service_id" },
      );
    }
  }

  revalidatePath("/services");
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function setServiceActive(id: string, active: boolean) {
  const db = createClient();
  const { error } = await db.from("services").update({ active }).eq("id", id);
  if (error) return { ok: false as const, message: "Could not update that service." };
  revalidatePath("/services");
  return { ok: true as const };
}

const HoursInput = z.object({
  staffId: z.string().uuid(),
  days: z.array(
    z.object({
      weekday: z.coerce.number().int().min(0).max(6),
      open: z.boolean(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ).length(7),
});

export async function saveHours(raw: unknown) {
  const parsed = HoursInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Check those times." };
  const { staffId, days } = parsed.data;

  for (const d of days) {
    if (d.open && d.endTime <= d.startTime) {
      return { ok: false as const, message: "Closing time has to be after opening time." };
    }
  }

  const db = createClient();
  const tid = await tenantId(db);
  if (!tid) return { ok: false as const, message: "No salon found for this login." };

  // Replace the whole week rather than diffing it — seven rows, and a partial
  // update that half-applies would leave the booking page offering hours you
  // do not actually work.
  const { error: delError } = await db.from("availability_rules").delete().eq("staff_id", staffId);
  if (delError) return { ok: false as const, message: "Could not update your hours." };

  const rows = days.filter((d) => d.open).map((d) => ({
    tenant_id: tid,
    staff_id: staffId,
    weekday: d.weekday,
    start_time: d.startTime,
    end_time: d.endTime,
  }));

  if (rows.length) {
    const { error } = await db.from("availability_rules").insert(rows);
    if (error) return { ok: false as const, message: "Could not save your hours." };
  }

  revalidatePath("/availability");
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function closeDate(staffId: string, onDate: string, reason: string) {
  const db = createClient();
  const tid = await tenantId(db);
  if (!tid) return { ok: false as const, message: "No salon found for this login." };

  const { error } = await db.from("availability_exceptions").upsert(
    { tenant_id: tid, staff_id: staffId, on_date: onDate, is_closed: true, reason: reason || null },
    { onConflict: "staff_id,on_date" },
  );
  if (error) return { ok: false as const, message: "Could not block that day." };

  revalidatePath("/availability");
  return { ok: true as const };
}

export async function reopenDate(id: string) {
  const db = createClient();
  const { error } = await db.from("availability_exceptions").delete().eq("id", id);
  if (error) return { ok: false as const, message: "Could not reopen that day." };
  revalidatePath("/availability");
  return { ok: true as const };
}
