/** Public Supabase settings. Safe in the browser: the publishable key has no table access (RLS, no grants). */
export function supabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return value;
}

export function supabasePublishableKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.");
  return value;
}
