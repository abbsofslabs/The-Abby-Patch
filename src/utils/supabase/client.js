import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

let browserClient;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

/**
 * Browser Supabase client for the React app.
 * Uses @supabase/ssr so auth cookies stay in sync when you add server routes later.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local and restart npm start (env vars load only at startup).'
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
}
