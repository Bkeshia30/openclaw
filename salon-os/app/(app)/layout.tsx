import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

const NAV = [
  { href: "/calendar", label: "Calendar" },
  { href: "/contacts", label: "Clients" },
  { href: "/services", label: "Services" },
  { href: "/availability", label: "Hours" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase.from("tenants").select("name, slug").maybeSingle();

  return (
    <div>
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/calendar" className="font-medium">{tenant?.name ?? "Salon OS"}</Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                {n.label}
              </Link>
            ))}
          </nav>
          {tenant?.slug && (
            <Link
              href={`/book/${tenant.slug}`}
              className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              View booking page
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
