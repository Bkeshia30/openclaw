import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { formatMoney } from "@/lib/money";
import { StatusButtons } from "./status-buttons";

export const dynamic = "force-dynamic";

type ApptRow = {
  id: string; starts_at: string; ends_at: string; status: string;
  price_cents: number; deposit_due_cents: number; amount_paid_cents: number;
  customer_note: string | null;
  contacts: { id: string; first_name: string | null; last_name: string | null; phone: string | null } | null;
  services: { name: string } | null;
};

const LABEL: Record<string, string> = {
  pending: "Unconfirmed", confirmed: "Confirmed", completed: "Done",
  cancelled: "Cancelled", no_show: "No-show",
};
const TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  completed: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  cancelled: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  no_show: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export default async function CalendarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);
  const horizon = new Date(startOfToday); horizon.setDate(horizon.getDate() + 30);

  const select =
    "id, starts_at, ends_at, status, price_cents, deposit_due_cents, amount_paid_cents, customer_note, " +
    "contacts(id, first_name, last_name, phone), services(name)";

  const [{ data: today }, { data: upcoming }, { data: needsClosing }] = await Promise.all([
    supabase.from("appointments").select(select)
      .gte("starts_at", startOfToday.toISOString()).lt("starts_at", endOfToday.toISOString())
      .order("starts_at"),
    supabase.from("appointments").select(select)
      .gte("starts_at", endOfToday.toISOString()).lt("starts_at", horizon.toISOString())
      .in("status", ["pending", "confirmed"]).order("starts_at").limit(50),
    supabase.from("appointments").select(select)
      .lt("starts_at", now.toISOString()).in("status", ["pending", "confirmed"])
      .order("starts_at", { ascending: false }).limit(20),
  ]);

  const todayRows = (today ?? []) as unknown as ApptRow[];
  const upcomingRows = (upcoming ?? []) as unknown as ApptRow[];
  const closingRows = (needsClosing ?? []) as unknown as ApptRow[];
  const bookedToday = todayRows
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .reduce((s, a) => s + Number(a.price_cents), 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </h1>
        <p className="text-sm text-neutral-500">{formatMoney(bookedToday)} booked today</p>
      </div>

      {closingRows.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Needs closing out</h2>
          <div className="mt-2 space-y-2">
            {closingRows.map((a) => <Row key={a.id} a={a} showDate />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Today</h2>
        <div className="mt-2 space-y-2">
          {todayRows.length === 0 && <Empty>Nothing booked today.</Empty>}
          {todayRows.map((a) => <Row key={a.id} a={a} />)}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Coming up</h2>
        <div className="mt-2 space-y-2">
          {upcomingRows.length === 0 && <Empty>Nothing booked in the next 30 days.</Empty>}
          {upcomingRows.map((a) => <Row key={a.id} a={a} showDate />)}
        </div>
      </section>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
      {children}
    </p>
  );
}

function Row({ a, showDate }: { a: ApptRow; showDate?: boolean }) {
  const start = new Date(a.starts_at);
  const name = [a.contacts?.first_name, a.contacts?.last_name].filter(Boolean).join(" ") || "Client";
  const owed = Number(a.deposit_due_cents) - Number(a.amount_paid_cents);

  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium tabular-nums">
          {showDate && `${start.toLocaleDateString([], { month: "short", day: "numeric" })}, `}
          {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <span className="font-medium">{name}</span>
        <span className="text-sm text-neutral-500">{a.services?.name ?? "Service"}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[a.status] ?? ""}`}>
          {LABEL[a.status] ?? a.status}
        </span>
        <span className="ml-auto text-sm tabular-nums">{formatMoney(a.price_cents)}</span>
      </div>

      {(a.contacts?.phone || a.customer_note || owed > 0) && (
        <p className="mt-1 text-sm text-neutral-500">
          {a.contacts?.phone && <a href={`tel:${a.contacts.phone}`} className="underline">{a.contacts.phone}</a>}
          {owed > 0 && <span className="ml-2 text-amber-700 dark:text-amber-400">{formatMoney(owed)} deposit outstanding</span>}
          {a.customer_note && <span className="ml-2">“{a.customer_note}”</span>}
        </p>
      )}

      {(a.status === "pending" || a.status === "confirmed") && (
        <StatusButtons id={a.id} status={a.status} />
      )}
    </div>
  );
}
