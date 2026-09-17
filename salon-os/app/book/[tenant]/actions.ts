"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/db/server";

/**
 * Notice what this schema does NOT accept: a price, a duration, or an end time.
 * The caller cannot express them, so there is nothing to validate and nothing to
 * tamper with. book_appointment() reads all three from the services table.
 */
const BookingInput = z.object({
  tenantSlug: z.string().min(1),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  email: z.string().email().max(255),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international number like +15551234567"),
  note: z.string().max(1000).optional(),
  consentSms: z.boolean().default(false),
  consentEmail: z.boolean().default(false),
});

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: "slot_taken" | "invalid" | "error"; message: string };

export async function bookAppointment(raw: unknown): Promise<BookingResult> {
  const parsed = BookingInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const i = parsed.data;

  // The public booking flow has no session, so it runs with the service role and
  // scopes the tenant from the URL slug — which the database function re-checks.
  const db = createAdminClient();
  const { data, error } = await db.rpc("book_appointment", {
    p_tenant_slug: i.tenantSlug,
    p_service_id: i.serviceId,
    p_staff_id: i.staffId,
    p_starts_at: i.startsAt,
    p_first_name: i.firstName,
    p_last_name: i.lastName || null,
    p_email: i.email,
    p_phone: i.phone,
    p_note: i.note ?? null,
    p_consent_sms: i.consentSms,
    p_consent_email: i.consentEmail,
  });

  if (error) {
    // 23P01 = exclusion_violation. Someone else took this slot between the page
    // rendering and this request arriving. That is a normal outcome, not a 500.
    if (error.code === "23P01") {
      return { ok: false, reason: "slot_taken", message: "That time was just booked. Pick another." };
    }
    if (error.code === "22023") {
      return { ok: false, reason: "invalid", message: error.message };
    }
    console.error("[booking] unexpected failure", error);
    return { ok: false, reason: "error", message: "Something went wrong. Nothing was charged." };
  }

  return { ok: true, appointmentId: data as string };
}
