/**
 * Fails at boot rather than at 2am in a route nobody tested.
 * Anything not prefixed NEXT_PUBLIC_ is only ever read on the server.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}. See .env.example`);
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

/** Server-only. Importing this from a client component is a build error by design. */
export function serviceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("serviceRoleKey() was called in the browser. This key bypasses every RLS policy.");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
