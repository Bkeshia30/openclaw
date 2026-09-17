"use client";

import { useState, useTransition } from "react";
import { saveService, setServiceActive } from "../actions";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

type Service = {
  id: string; name: string; duration_minutes: number; buffer_after_minutes: number;
  price_cents: number; deposit_cents: number; active: boolean;
};

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";

export function ServiceEditor({ services }: { services: Service[] }) {
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  return (
    <div className="mt-6">
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {services.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.name}
                {!s.active && <span className="ml-2 text-xs text-neutral-500">(hidden)</span>}
              </p>
              <p className="text-sm text-neutral-500">
                {s.duration_minutes} min
                {s.buffer_after_minutes > 0 && ` + ${s.buffer_after_minutes} min cleanup`}
                {s.deposit_cents > 0 && ` · ${formatMoney(s.deposit_cents)} deposit`}
              </p>
            </div>
            <span className="tabular-nums">{formatMoney(s.price_cents)}</span>
            <button
              onClick={() => setEditing(s)}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-sm dark:border-neutral-700"
            >
              Edit
            </button>
          </div>
        ))}
        {services.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            No services yet. Add one so clients have something to book.
          </p>
        )}
      </div>

      {editing === null ? (
        <button
          onClick={() => setEditing("new")}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900"
        >
          Add a service
        </button>
      ) : (
        <Form
          service={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Form({ service, onDone }: { service: Service | null; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await saveService({
        id: service?.id,
        name: String(formData.get("name") ?? ""),
        durationMinutes: formData.get("duration"),
        bufferAfterMinutes: formData.get("buffer"),
        priceCents: parseMoneyToCents(String(formData.get("price") ?? "")),
        depositCents: parseMoneyToCents(String(formData.get("deposit") ?? "")),
        active: true,
      });
      if (r.ok) onDone();
      else setError(r.message);
    });
  }

  return (
    <form action={submit} className="mt-5 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <label htmlFor="svc-name" className="text-sm text-neutral-500">Name</label>
        <input id="svc-name" name="name" required defaultValue={service?.name ?? ""} placeholder="Loc retwist" className={input} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="svc-price" className="text-sm text-neutral-500">Price</label>
          <input id="svc-price" name="price" inputMode="decimal" defaultValue={service ? service.price_cents / 100 : ""} placeholder="120" className={input} />
        </div>
        <div>
          <label htmlFor="svc-deposit" className="text-sm text-neutral-500">Deposit to hold the spot</label>
          <input id="svc-deposit" name="deposit" inputMode="decimal" defaultValue={service ? service.deposit_cents / 100 : "0"} className={input} />
        </div>
        <div>
          <label htmlFor="svc-duration" className="text-sm text-neutral-500">Minutes</label>
          <input id="svc-duration" name="duration" inputMode="numeric" required defaultValue={service?.duration_minutes ?? ""} placeholder="120" className={input} />
        </div>
        <div>
          <label htmlFor="svc-buffer" className="text-sm text-neutral-500">Cleanup after (minutes)</label>
          <input id="svc-buffer" name="buffer" inputMode="numeric" defaultValue={service?.buffer_after_minutes ?? 15} className={input} />
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        Cleanup time is blocked after the appointment, so nobody can book into it.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-700">
          Cancel
        </button>
        {service && (
          <button
            type="button"
            onClick={() => start(async () => { await setServiceActive(service.id, !service.active); onDone(); })}
            className="rounded-lg px-4 py-2 text-sm text-neutral-500 underline"
          >
            {service.active ? "Hide from booking page" : "Show on booking page"}
          </button>
        )}
      </div>
    </form>
  );
}
