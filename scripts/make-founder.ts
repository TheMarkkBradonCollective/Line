/**
 * npm run make-founder -- someone@example.com
 * Gives the Founder seat (role + every founder permission) to a person who already signed up.
 * Writes the change to the audit log. Needs DATABASE_URL (or DIRECT_DATABASE_URL).
 */
import { createSql, Db, scriptDatabaseUrl } from "../lib/db";
import { ROLE_TEMPLATES } from "../lib/permissions";
import { ensureProfile } from "../lib/session";
async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Usage: npm run make-founder -- someone@example.com");
  const sql = createSql({ url: scriptDatabaseUrl(), max: 1 });
  try {
    const db = new Db(sql);
    const authUser = (await db.get("SELECT id::text AS id, email, raw_user_meta_data FROM auth.users WHERE lower(email) = ?", [email])) as
      | { id: string; email: string | null; raw_user_meta_data: Record<string, unknown> | null }
      | undefined;
    if (!authUser) throw new Error(`No LINE account for ${email}. Sign up on LINE first, then run this again.`);
    const profile = await ensureProfile(db, { id: authUser.id, email: authUser.email, meta: authUser.raw_user_meta_data ?? {} });
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
