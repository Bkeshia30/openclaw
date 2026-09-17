import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { describeEvent } from "@/lib/events/emit";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ContactDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  // 404, not 403. A 403 would confirm the row exists and belongs to someone else;
  // a 404 tells an attacker nothing at all.
  if (!contact) notFound();

  const [{ data: events }, { data: appointments }] = await Promise.all([
    supabase
      .from("events")
      .select("id, type, payload, occurred_at")
      .eq("contact_id", params.id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("appointments")
      .select("id, starts_at, status, price_cents, services(name)")
      .eq("contact_id", params.id)
      .order("starts_at", { ascending: false })
      .limit(20),
  ]);

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <p className="mt-1 text-neutral-500">
        {contact.email ?? "—"} · {contact.phone ?? "—"} · {contact.lifecycle} ·{" "}
        {formatMoney(contact.ltv_cents)} lifetime
      </p>
      {contact.opted_out_at && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Opted out of messages. Automations will skip this contact.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Appointments</h2>
        <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {(appointments ?? []).map((a: any) => (
            <li key={a.id} className="flex justify-between py-2 text-sm">
              <span>{a.services?.name ?? "Service"}</span>
              <span className="text-neutral-500">
                {new Date(a.starts_at).toLocaleString()} · {a.status}
              </span>
            </li>
          ))}
          {(appointments ?? []).length === 0 && <li className="py-2 text-sm text-neutral-500">None yet.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Timeline</h2>
        {/* Not a feature — just a query over `events`. Same table the automations read. */}
        <ol className="mt-2 space-y-2">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <time className="w-40 shrink-0 text-neutral-500">
                {new Date(e.occurred_at).toLocaleString()}
              </time>
              <span>{describeEvent(e.type, (e.payload ?? {}) as Record<string, unknown>)}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="text-sm text-neutral-500">Nothing recorded yet.</li>}
        </ol>
      </section>
    </main>
  );
}
