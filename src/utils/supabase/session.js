import { createClient, isSupabaseConfigured } from './client';

/**
 * Keeps the Supabase session refreshed in the browser (CRA equivalent of Next middleware).
 * Call once at app startup. No-op if Supabase env vars are not set.
 */
export function initSupabaseSession() {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const supabase = createClient();
  supabase.auth.getSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(() => {
    // Session cookies are updated automatically by @supabase/ssr createBrowserClient.
  });

  return () => subscription.unsubscribe();
}
