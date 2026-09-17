"use client";

import { useState, useTransition } from "react";
import { saveHours, closeDate, reopenDate } from "../actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Rule = { weekday: number; start_time: string; end_time: string };
type Exception = { id: string; on_date: string; reason: string | null };

const input =
  "rounded-lg border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900";

export function HoursEditor({
  staffId, rules, exceptions,
}: { staffId: string; rules: Rule[]; exceptions: Exception[] }) {
  const [days, setDays] = useState(() =>
    DAYS.map((_, weekday) => {
      const r = rules.find((x) => x.weekday === weekday);
      return {
        weekday,
        open: Boolean(r),
        startTime: r ? r.start_time.slice(0, 5) : "09:00",
        endTime: r ? r.end_time.slice(0, 5) : "18:00",
      };
    }),
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(weekday: number, patch: Partial<(typeof days)[number]>) {
    setDays((d) => d.map((x) => (x.weekday === weekday ? { ...x, ...patch } : x)));
    setMsg(null);
  }

  function save() {
    setError(null); setMsg(null);
    start(async () => {
      const r = await saveHours({ staffId, days });
      if (r.ok) setMsg("Saved. Your booking page is updated.");
      else setError(r.message);
    });
  }

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Every week</h2>
        <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {days.map((d) => (
            <div key={d.weekday} className="flex flex-wrap items-center gap-3 py-2.5">
              <label className="flex w-36 items-center gap-2">
                <input
                  id={`day-${d.weekday}`}
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => update(d.weekday, { open: e.target.checked })}
                />
                <span className={d.open ? "font-medium" : "text-neutral-500"}>{DAYS[d.weekday]}</span>
              </label>
              {d.open ? (
                <div className="flex items-center gap-2">
                  <input
                    id={`start-${d.weekday}`} type="time" value={d.startTime}
                    onChange={(e) => update(d.weekday, { startTime: e.target.value })} className={input}
                  />
                  <span className="text-neutral-500">to</span>
                  <input
                    id={`end-${d.weekday}`} type="time" value={d.endTime}
                    onChange={(e) => update(d.weekday, { endTime: e.target.value })} className={input}
                  />
                </div>
              ) : (
                <span className="text-sm text-neutral-500">Closed</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={save} disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "Saving…" : "Save hours"}
          </button>
          {msg && <span className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Days off</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Block a specific date — a holiday, a trip, a day you need back. It overrides your weekly hours.
        </p>
        <BlockDay staffId={staffId} />
        <ul className="mt-3 space-y-1">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center gap-3 text-sm">
              <span className="tabular-nums">
                {new Date(`${e.on_date}T12:00:00`).toLocaleDateString([], {
                  weekday: "short", month: "short", day: "numeric",
                })}
              </span>
              {e.reason && <span className="text-neutral-500">{e.reason}</span>}
              <button
                onClick={() => start(async () => { await reopenDate(e.id); })}
                className="ml-auto text-neutral-500 underline"
              >
                Reopen
              </button>
            </li>
          ))}
          {exceptions.length === 0 && (
            <li className="text-sm text-neutral-500">No days blocked.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function BlockDay({ staffId }: { staffId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    const date = String(formData.get("date") ?? "");
    if (!date) return;
    setError(null);
    start(async () => {
      const r = await closeDate(staffId, date, String(formData.get("reason") ?? ""));
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <form action={submit} className="mt-3 flex flex-wrap items-center gap-2">
      <input id="block-date" type="date" name="date" required className={input} />
      <input id="block-reason" name="reason" placeholder="Reason (optional)" className={input} />
      <button
        type="submit" disabled={pending}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
      >
        Block it
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
