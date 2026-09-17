import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { ServiceEditor } from "./service-editor";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, buffer_after_minutes, price_cents, deposit_cents, active")
    .order("active", { ascending: false })
    .order("name");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Services</h1>
      <p className="mt-1 text-sm text-neutral-500">
        What you offer. Only active services appear on your booking page.
      </p>
      <ServiceEditor services={services ?? []} />
    </main>
  );
}
