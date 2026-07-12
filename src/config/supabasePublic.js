/**
 * Public Supabase client config.
 * The anon/publishable key is safe to ship in the browser (RLS protects data).
 * Env vars still win when present (local .env.local or Vercel build env).
 */
export const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || 'https://owlbtvtptenxtuqahogp.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bGJ0dnRwdGVueHR1cWFob2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzODU5NjksImV4cCI6MjA5ODk2MTk2OX0.vco_4bcok3ylz5BXlqAhGXM8J1yoIHWwiWv3FySgEYE';
