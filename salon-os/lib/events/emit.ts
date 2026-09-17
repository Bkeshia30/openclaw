import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The single way anything writes to `events`.
 *
 * One append-only table feeds three features: the contact timeline, the
 * automation triggers, and analytics. Keeping every write behind one function is
 * what makes that true — the moment two code paths write events differently, the
 * timeline and the automations start disagreeing about what happened.
 */
export type EventType =
  | "contact.created"
  | "note.added"
  | "form.submitted"
  | "page.viewed"
  | "ad.clicked"
  | "appointment.created"
  | "appointment.confirmed"
  | "appointment.cancelled"
  | "appointment.completed"
  | "appointment.no_show"
  | "payment.succeeded"
  | "payment.refunded"
  | "message.sent"
  | "message.replied"
  | "review.requested"
  | "review.received"
  | "post.published";

export type EmitInput = {
  tenantId: string;
  type: EventType;
  contactId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
  /**
   * Makes emit() safe to retry. Use a key derived from the thing that happened
   * ("appointment.created:<id>"), not from the moment it was called.
   */
  dedupeKey?: string | null;
};

export async function emit(db: SupabaseClient, input: EmitInput): Promise<void> {
  const { error } = await db.from("events").insert({
    tenant_id: input.tenantId,
    type: input.type,
    contact_id: input.contactId ?? null,
    subject_type: input.subjectType ?? null,
    subject_id: input.subjectId ?? null,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey ?? null,
  });

  // 23505 = this exact event was already recorded. That is success, not failure.
  if (error && error.code !== "23505") {
    // A failed emit must never roll back the business action that caused it.
    // Losing a timeline row is bad; losing the appointment is worse.
    console.error("[events] emit failed", { type: input.type, error });
  }
}

/** Human-readable timeline lines. The CRM screen is a query over `events`, not a feature. */
export function describeEvent(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "contact.created":      return "Added as a contact";
    case "form.submitted":       return `Submitted a form${payload.funnel ? ` on ${payload.funnel}` : ""}`;
    case "appointment.created":  return "Booked an appointment";
    case "appointment.confirmed":return "Appointment confirmed";
    case "appointment.cancelled":return `Appointment cancelled${payload.reason ? ` — ${payload.reason}` : ""}`;
    case "appointment.completed":return "Appointment completed";
    case "appointment.no_show":  return "Did not show up";
    case "payment.succeeded":    return "Paid";
    case "payment.refunded":     return "Refunded";
    case "message.sent":         return "We sent a message";
    case "message.replied":      return "They replied";
    case "review.received":      return "Left a review";
    default:                     return type;
  }
}
