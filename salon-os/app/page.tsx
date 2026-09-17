import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Salon OS</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Booking, CRM, payments, funnels, ads and content — one contact list, one timeline.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/contacts" className="rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900">
          Open the dashboard
        </Link>
        <Link href="/login" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-700">
          Sign in
        </Link>
      </div>
    </main>
  );
}
