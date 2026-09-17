"use client";

import { useState, useTransition } from "react";
import { setAppointmentStatus } from "../actions";

export function StatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(next: string) {
    setError(null);
    start(async () => {
      const r = await setAppointmentStatus(id, next);
      if (!r.ok) setError(r.message);
    });
  }

  const cls =
    "rounded-lg border border-neutral-300 px-2.5 py-1 text-sm disabled:opacity-50 dark:border-neutral-700";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {status === "pending" && (
        <button className={cls} disabled={pending} onClick={() => go("confirmed")}>Confirm</button>
      )}
      <button className={cls} disabled={pending} onClick={() => go("completed")}>Done</button>
      <button className={cls} disabled={pending} onClick={() => go("no_show")}>No-show</button>
      <button className={cls} disabled={pending} onClick={() => go("cancelled")}>Cancel</button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
