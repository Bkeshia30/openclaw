import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, serviceRoleKey } from "@/lib/env";

/**
 * The normal server client. Carries the signed-in user's session, so every query
 * it makes is filtered by RLS. This is what almost all app code should use.
 */
export function createClient(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled in middleware instead.
        }
      },
    },
  });
}

/**
 * Bypasses RLS entirely. Use ONLY for public flows that have no session —
 * the booking page, funnel form submissions, provider webhooks — and always
 * scope the tenant yourself from a URL slug or a verified webhook payload.
 *
 * Every call site is a place where a mistake becomes a cross-tenant data leak,
 * so there should be very few of them and each should be obvious.
 */
export function createAdminClient(): SupabaseClient {
  return createSupabaseClient(env.supabaseUrl, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
