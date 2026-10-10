import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Supabase Auth for the signed-in browser, carried in cookies. Used for auth only, never for tables. */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) jar.set(name, value, options);
        } catch {
          // Server components cannot set cookies. The middleware refreshes the session instead.
        }
      },
    },
  });
}
