import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { q?: string; lifecycle?: string; cursor?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // No .eq('tenant_id', ...) anywhere: RLS already scoped this to the caller's
  // tenant. If this query is ever wrong, it returns nothing rather than someone
  // else's client list.
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, lifecycle, ltv_cents, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (searchParams.q) {
    const q = `%${searchParams.q}%`;
    query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`);
  }
  if (searchParams.lifecycle) query = query.eq("lifecycle", searchParams.lifecycle);
  // Cursor pagination, not offset: offset silently skips rows as new contacts arrive.
  if (searchParams.cursor) query = query.lt("created_at", searchParams.cursor);

  const { data: contacts, error } = await query;
  if (error) throw error;

  const last = contacts?.at(-1);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <span className="text-sm text-neutral-500">{contacts?.length ?? 0} shown</span>
      </div>

      <form className="mt-6 flex gap-2">
        <input
          name="q" defaultValue={searchParams.q ?? ""} placeholder="Search name, email or phone"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <select
          name="lifecycle" defaultValue={searchParams.lifecycle ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">All</option>
          {["lead", "qualified", "customer", "lapsed", "blocked"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900">
          Filter
        </button>
      </form>

      <ul className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
        {(contacts ?? []).map((c) => (
          <li key={c.id}>
            <Link href={`/contacts/${c.id}`} className="flex items-center justify-between gap-4 py-3 hover:opacity-70">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact"}
                </p>
                <p className="truncate text-sm text-neutral-500">{c.email ?? c.phone ?? "No contact details"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm">{formatMoney(c.ltv_cents)}</p>
                <p className="text-xs uppercase tracking-wide text-neutral-500">{c.lifecycle}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {(contacts?.length ?? 0) === 0 && (
        <p className="mt-10 text-center text-neutral-500">No contacts match that.</p>
      )}

      {last && contacts?.length === PAGE_SIZE && (
        <Link
          href={`/contacts?cursor=${encodeURIComponent(last.created_at)}`}
          className="mt-6 inline-block text-sm underline"
        >
          Next page
        </Link>
      )}
    </main>
  );
}
