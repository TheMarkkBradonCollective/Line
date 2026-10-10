/**
 * npm run make-founder -- someone@example.com
 * Gives the Founder seat (role + every founder permission) to a person who already signed up.
 * Writes the change to the audit log. Needs DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 */
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { ROLE_TEMPLATES } from "../lib/permissions";
import { ensureProfile } from "../lib/session";
import { supabaseAdmin } from "../lib/supabase/admin";

async function findAuthUser(email: string) {
  const admin = supabaseAdmin();
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((user) => user.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Usage: npm run make-founder -- someone@example.com");
  const authUser = await findAuthUser(email);
  if (!authUser) throw new Error(`No Supabase account for ${email}. Sign up on LINE first, then run this again.`);
  if (!authUser.email_confirmed_at) console.warn("Note: that email isn't confirmed yet. They can sign in once it is.");
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    const db = new Db(sql);
    const profile = await ensureProfile(db, { id: authUser.id, email: authUser.email ?? null, meta: authUser.user_metadata ?? {} });
    const before = profile.role;
    await db.tx(async (tx) => {
      await tx.run("UPDATE profiles SET role = 'founder', suspended = 0, restricted = 0 WHERE id = ?", [profile.id]);
      await tx.run("DELETE FROM permissions WHERE user_id = ?", [profile.id]);
      for (const permission of ROLE_TEMPLATES.founder) {
        await tx.run("INSERT INTO permissions (user_id, permission) VALUES (?, ?)", [profile.id, permission]);
      }
      await tx.run(
        `INSERT INTO audit_log (staff_id, staff_role, action, target_type, target_id, reason, previous_state, new_state, created_at)
         VALUES (?, 'founder', 'grant_founder', 'user', ?, 'Founder seat granted from the command line (npm run make-founder).', ?, 'founder', ?)`,
        [profile.id, profile.id, before, new Date().toISOString()],
      );
    });
    console.log(`@${profile.username} (${email}) is now Founder with ${ROLE_TEMPLATES.founder.length} permissions.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
