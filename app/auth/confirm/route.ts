import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Where the confirmation email lands. Handles both shapes Supabase can send:
 * ?code=… (PKCE, the default with @supabase/ssr) and ?token_hash=…&type=… (custom email template).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await supabaseServer();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  const target = new URL(ok ? "/timeline" : "/", url.origin);
  target.searchParams.set(
    ok ? "notice" : "error",
    ok ? "Email confirmed. Welcome to LINE." : "That link didn’t sign you in. If you already confirmed your email, sign in below.",
  );
  return NextResponse.redirect(target);
}
