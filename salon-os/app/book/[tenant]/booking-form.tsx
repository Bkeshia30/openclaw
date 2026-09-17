"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { bookAppointment } from "./actions";
import { formatMoney } from "@/lib/money";
import type { Slot } from "@/lib/booking/slots";

export function BookingForm(props: {
  tenantSlug: string;
  tenantTz: string;
  serviceId: string;
  staffId: string;
  depositCents: number;
  slots: Slot[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [slotTaken, setSlotTaken] = useState(false);

  async function submit(formData: FormData) {
    if (!selected) return;
    setState("saving");
    setError(null);

    const result = await bookAppointment({
      tenantSlug: props.tenantSlug,
      serviceId: props.serviceId,
      staffId: props.staffId,
      startsAt: selected,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      note: String(formData.get("note") ?? "") || undefined,
      consentSms: formData.get("consent") === "on",
      consentEmail: formData.get("consent") === "on",
    });

    if (result.ok) {
      setState("done");
      return;
    }
    setState("idle");
    setError(result.message);
    // The slot list on screen is now stale. Say so plainly rather than letting
    // them retry the same dead slot.
    if (result.reason === "slot_taken") setSlotTaken(true);
  }

  if (state === "done") {
    return (
      <div className="mt-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="font-medium">You&apos;re booked.</p>
        <p className="mt-1 text-sm text-neutral-500">
          {DateTime.fromISO(selected!).setZone(props.tenantTz).toFormat("cccc d LLLL, h:mm a")}
        </p>
        <p className="mt-2 text-sm text-neutral-500">A confirmation is on its way.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-3 gap-2">
        {props.slots.map((s) => {
          const label = DateTime.fromISO(s.startsAt).setZone(props.tenantTz).toFormat("h:mm a");
          return (
            <button
              key={s.startsAt}
              type="button"
              onClick={() => { setSelected(s.startsAt); setSlotTaken(false); }}
              className={`rounded-lg border px-2 py-2 text-sm ${
                selected === s.startsAt
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {slotTaken && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Someone booked that time while you were filling this in.{" "}
          <button type="button" onClick={() => location.reload()} className="underline">
            Refresh the times
          </button>
        </p>
      )}

      {selected && (
        <form action={submit} className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input name="firstName" required placeholder="First name" className={inputCls} />
            <input name="lastName" placeholder="Last name" className={inputCls} />
          </div>
          <input name="email" type="email" required placeholder="you@example.com" className={inputCls} />
          <input name="phone" required placeholder="+15551234567" className={inputCls} />
          <textarea name="note" rows={2} placeholder="Anything I should know?" className={inputCls} />

          <label className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" name="consent" className="mt-1" />
            <span>
              Text and email me about this appointment and occasional offers. Reply STOP to opt out anytime.
            </span>
          </label>

          {props.depositCents > 0 && (
            <p className="text-sm text-neutral-500">
              A {formatMoney(props.depositCents)} deposit holds your spot.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit" disabled={state === "saving"}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {state === "saving" ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";
