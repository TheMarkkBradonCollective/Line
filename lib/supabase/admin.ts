import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service client with SUPABASE_SECRET_KEY. Server only: Storage (signed URLs, signed uploads)
 * and the auth admin API. Never sent to the browser.
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin() {
  if (client) return client;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  client = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
