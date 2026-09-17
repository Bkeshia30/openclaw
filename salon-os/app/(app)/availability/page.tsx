import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { HoursEditor } from "./hours-editor";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff").select("id, display_name").eq("active", true).order("display_name").limit(1);

  const me = staff?.[0];
  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Hours</h1>
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          No stylist record found. Run the setup SQL from the README first — it creates your salon,
          your stylist record and your login in one go.
        </p>
      </main>
    );
  }

  const [{ data: rules }, { data: exceptions }] = await Promise.all([
    supabase.from("availability_rules").select("weekday, start_time, end_time").eq("staff_id", me.id),
    supabase.from("availability_exceptions")
      .select("id, on_date, reason").eq("staff_id", me.id)
      .gte("on_date", new Date().toISOString().slice(0, 10)).order("on_date").limit(30),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Hours</h1>
      <p className="mt-1 text-sm text-neutral-500">
        When you work. Your booking page only offers times inside these hours.
      </p>
      <HoursEditor
        staffId={me.id}
        rules={rules ?? []}
        exceptions={exceptions ?? []}
      />
    </main>
  );
}
