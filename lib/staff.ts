import type { Db } from "./db";
import {
  isPermission,
  isRole,
  PERMISSIONS,
  queuesForPermissions,
  type Permission,
  type Queue,
  type Role,
} from "./permissions";
import { getPost, getUserById, getUserByUsername, hasPermission, listPermissions, listUsers, mustUser } from "./social";
import { mapUser, type User, type UserRow } from "./types";

export type StaffActor = User;

function requireReason(reason: string) {
  const text = reason.trim();
  if (text.length < 3) throw new Error("Give a reason. It is written into the audit log.");
  return text.slice(0, 500);
}

export async function writeAudit(db: Db,
  actor: StaffActor,
  input: {
    action: string;
    reason: string;
    targetType?: string | null;
    targetId?: number | null;
    previousState?: string | null;
    newState?: string | null;
    caseId?: number | null;
  },
) {
  await db.run(`INSERT INTO audit_log
      (staff_id, staff_role, action, target_type, target_id, reason, previous_state, new_state, case_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [actor.id,
    actor.role,
    input.action,
    input.targetType ?? null,
    input.targetId ?? null,
    requireReason(input.reason),
    input.previousState ?? null,
    input.newState ?? null,
    input.caseId ?? null,
    new Date().toISOString()]);
}

async function gate(db: Db, actor: StaffActor, permission: Permission) {
  if (!await hasPermission(db, actor.id, permission)) {
    throw new Error("That panel is closed. Your account does not have this permission.");
  }
}

export async function searchAccounts(db: Db, actor: StaffActor, query: string) {
  await gate(db, actor, "view_user_account");
  const q = query.trim().toLowerCase();
  const rows = await db.all(`SELECT * FROM profiles
       WHERE username LIKE ? OR lower(display_name) LIKE ?
       ORDER BY display_name LIMIT 30`, [`%${q}%`, `%${q}%`]) as UserRow[];
  return Promise.all(
    rows.map(async (row) => ({
      user: mapUser(row),
      permissions: await listPermissions(db, row.id),
    })),
  );
}

export async function restrictAccount(db: Db, actor: StaffActor, userId: number, restricted: boolean, reason: string) {
  await gate(db, actor, "restrict_accounts");
  const user = await mustUser(db, userId);
  if (user.id === actor.id) throw new Error("You cannot restrict your own account.");
  const previous = user.restricted ? "restricted" : "open";
  const next = restricted ? "restricted" : "open";
  await db.run("UPDATE profiles SET restricted = ? WHERE id = ?", [restricted ? 1 : 0, userId]);
  await writeAudit(db, actor, {
    action: restricted ? "restrict_account" : "lift_restriction",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: previous,
    newState: next,
  });
}

export async function suspendAccount(db: Db, actor: StaffActor, userId: number, suspended: boolean, reason: string) {
  await gate(db, actor, "suspend_accounts");
  const user = await mustUser(db, userId);
  if (user.id === actor.id) throw new Error("You cannot suspend your own account.");
  if (await hasPermission(db, user.id, "platform_ownership") && !await hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("Only the founder seat can suspend an owner.");
  }
  const previous = user.suspended ? "suspended" : "active";
  const next = suspended ? "suspended" : "active";
  await db.run("UPDATE profiles SET suspended = ? WHERE id = ?", [suspended ? 1 : 0, userId]);
  await writeAudit(db, actor, {
    action: suspended ? "suspend_account" : "restore_account",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: previous,
    newState: next,
  });
}

export async function hidePost(db: Db, actor: StaffActor, postId: number, reason: string) {
  await gate(db, actor, "moderate_content");
  const post = await getPost(db, postId);
  if (!post) throw new Error("No such post.");
  const why = requireReason(reason);
  await db.run("UPDATE posts SET hidden = 1, hidden_reason = ? WHERE id = ?", [why, postId]);
  await writeAudit(db, actor, {
    action: "hide_content",
    reason: why,
    targetType: "post",
    targetId: postId,
    previousState: post.hidden ? "hidden" : "visible",
    newState: "hidden",
  });
}

export async function restorePost(db: Db, actor: StaffActor, postId: number, reason: string) {
  await gate(db, actor, "moderate_content");
  const post = await getPost(db, postId);
  if (!post) throw new Error("No such post.");
  await db.run("UPDATE posts SET hidden = 0, hidden_reason = NULL WHERE id = ?", [postId]);
  await writeAudit(db, actor, {
    action: "restore_content",
    reason,
    targetType: "post",
    targetId: postId,
    previousState: post.hidden ? "hidden" : "visible",
    newState: "visible",
  });
}

export async function createReport(db: Db,
  reporterId: number,
  input: { targetType: string; targetId: number; category: string; details: string },
) {
  const types = new Set(["post", "video", "profile", "message", "account"]);
  const categories = new Set(["harassment", "spam", "abuse", "other"]);
  if (!types.has(input.targetType)) throw new Error("Choose what you are reporting.");
  if (!categories.has(input.category)) throw new Error("Choose a reason.");
  const now = new Date().toISOString();
  return db.insert(`INSERT INTO reports
        (reporter_id, target_type, target_id, category, details, status, queue, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', 'moderator', ?, ?)`, [reporterId, input.targetType, input.targetId, input.category, input.details.trim().slice(0, 1000), now, now]);
}

export type ReportRecord = {
  id: number;
  reporterId: number;
  reporterName: string;
  targetType: string;
  targetId: number;
  category: string;
  details: string;
  status: string;
  queue: Queue;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  targetLabel: string;
};

async function mapReport(db: Db,
  row: {
    id: number;
    reporter_id: number;
    reporter_name: string;
    target_type: string;
    target_id: number;
    category: string;
    details: string;
    status: string;
    queue: Queue;
    resolution: string | null;
    created_at: string;
    updated_at: string;
  },
): Promise<ReportRecord> {
  let targetLabel = `${row.target_type} #${row.target_id}`;
  if (row.target_type === "post" || row.target_type === "video") {
    const post = await getPost(db, row.target_id);
    if (post) {
      const author = await getUserById(db, post.authorId);
      targetLabel = `${post.kind} by ${author?.displayName ?? "someone"}: ${post.body.slice(0, 80)}`;
    }
  } else if (row.target_type === "profile" || row.target_type === "account" || row.target_type === "message") {
    const user = await getUserById(db, row.target_id);
    if (user) targetLabel = `${user.displayName} (@${user.username})`;
  }
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    targetType: row.target_type,
    targetId: row.target_id,
    category: row.category,
    details: row.details,
    status: row.status,
    queue: row.queue,
    resolution: row.resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    targetLabel,
  };
}

export async function listReports(db: Db, actor: StaffActor) {
  const queues = queuesForPermissions(await listPermissions(db, actor.id));
  if (queues.length === 0) return [];
  const placeholders = queues.map(() => "?").join(", ");
  const rows = await db.all(`SELECT r.*, u.display_name AS reporter_name
       FROM reports r JOIN profiles u ON u.id = r.reporter_id
       WHERE r.queue IN (${placeholders}) AND r.status != 'resolved'
       ORDER BY r.updated_at DESC`, [...queues]) as Parameters<typeof mapReport>[1][];
  return Promise.all(rows.map((row) => mapReport(db, row)));
}

export async function listResolvedReports(db: Db, actor: StaffActor) {
  if (!await hasPermission(db, actor.id, "review_reports") && !await hasPermission(db, actor.id, "access_audit_logs")) {
    return [];
  }
  const rows = await db.all(`SELECT r.*, u.display_name AS reporter_name
       FROM reports r JOIN profiles u ON u.id = r.reporter_id
       WHERE r.status = 'resolved'
       ORDER BY r.updated_at DESC LIMIT 20`) as Parameters<typeof mapReport>[1][];
  return Promise.all(rows.map((row) => mapReport(db, row)));
}

async function reportRow(db: Db, id: number) {
  return await db.get("SELECT * FROM reports WHERE id = ?", [id]) as
    | { id: number; queue: Queue; status: string; target_type: string; target_id: number }
    | undefined;
}

async function assertQueueAccess(db: Db, actor: StaffActor, queue: Queue) {
  const queues = queuesForPermissions(await listPermissions(db, actor.id));
  if (!queues.includes(queue)) {
    throw new Error("This case is in a queue your permissions do not open.");
  }
}

export async function escalateReport(db: Db, actor: StaffActor, reportId: number, reason: string, toQueue?: Queue) {
  const report = await reportRow(db, reportId);
  if (!report || report.status === "resolved") throw new Error("That case is not open.");
  await assertQueueAccess(db, actor, report.queue);
  const ladder: Queue[] = ["moderator", "senior_moderator", "manager", "director", "administrator", "founder"];
  const index = ladder.indexOf(report.queue);
  let next: Queue;
  if (report.queue === "director" && (toQueue === "administrator" || toQueue === "founder")) {
    next = toQueue;
  } else if (report.queue === "administrator" && toQueue === "founder") {
    next = "founder";
  } else if (toQueue && toQueue !== ladder[index + 1]) {
    throw new Error("Escalate one step, or send a director case to Administrator or Founder.");
  } else {
    if (index < 0 || index >= ladder.length - 1) throw new Error("This case is already with the founder.");
    next = ladder[index + 1];
  }
  const why = requireReason(reason);
  const now = new Date().toISOString();
  await db.run("UPDATE reports SET queue = ?, status = 'escalated', updated_at = ? WHERE id = ?", [next, now, reportId]);
  await writeAudit(db, actor, {
    action: "escalate_report",
    reason: why,
    targetType: report.target_type,
    targetId: report.target_id,
    previousState: report.queue,
    newState: next,
    caseId: reportId,
  });
}

export async function resolveReport(db: Db, actor: StaffActor, reportId: number, reason: string) {
  const report = await reportRow(db, reportId);
  if (!report || report.status === "resolved") throw new Error("That case is already closed.");
  await assertQueueAccess(db, actor, report.queue);
  const why = requireReason(reason);
  const now = new Date().toISOString();
  await db.run("UPDATE reports SET status = 'resolved', resolution = ?, updated_at = ? WHERE id = ?", [why, now, reportId]);
  await writeAudit(db, actor, {
    action: "resolve_report",
    reason: why,
    targetType: report.target_type,
    targetId: report.target_id,
    previousState: report.status,
    newState: "resolved",
    caseId: reportId,
  });
}

export async function listTickets(db: Db, actor: StaffActor) {
  await gate(db, actor, "manage_support_tickets");
  return await db.all(`SELECT t.*, u.display_name AS user_name, u.username
       FROM tickets t JOIN profiles u ON u.id = t.user_id
       ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, t.created_at DESC`) as {
    id: number;
    user_id: number;
    user_name: string;
    username: string;
    subject: string;
    body: string;
    status: string;
    created_at: string;
  }[];
}

export async function updateTicket(db: Db, actor: StaffActor, ticketId: number, status: string, reason: string) {
  await gate(db, actor, "manage_support_tickets");
  if (!["open", "pending", "closed"].includes(status)) throw new Error("Unknown ticket status.");
  const ticket = await db.get("SELECT id, status, user_id FROM tickets WHERE id = ?", [ticketId]) as
    | { id: number; status: string; user_id: number }
    | undefined;
  if (!ticket) throw new Error("No such ticket.");
  await db.run("UPDATE tickets SET status = ?, assignee_id = ? WHERE id = ?", [status, actor.id, ticketId]);
  await writeAudit(db, actor, {
    action: "update_ticket",
    reason,
    targetType: "ticket",
    targetId: ticketId,
    previousState: ticket.status,
    newState: status,
  });
}

export async function listAudit(db: Db, actor: StaffActor) {
  await gate(db, actor, "access_audit_logs");
  return await db.all(`SELECT a.*, u.display_name AS staff_name, u.username AS staff_username
       FROM audit_log a JOIN profiles u ON u.id = a.staff_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT 200`) as {
    id: number;
    staff_id: number;
    staff_name: string;
    staff_username: string;
    staff_role: string;
    action: string;
    target_type: string | null;
    target_id: number | null;
    reason: string;
    previous_state: string | null;
    new_state: string | null;
    case_id: number | null;
    created_at: string;
  }[];
}

const SETTING_GATES: Record<string, Permission> = {
  site_tagline: "manage_platform_settings",
  signups_open: "manage_platform_settings",
  staff_reason_required: "manage_security_settings",
  billing_note: "manage_financial_settings",
  sharing_paused: "access_emergency_controls",
  ownership_note: "platform_ownership",
  security_note: "manage_security_settings",
};

export async function updateSetting(db: Db, actor: StaffActor, key: string, value: string, reason: string) {
  const permission = SETTING_GATES[key];
  if (!permission) throw new Error("That setting is not editable.");
  await gate(db, actor, permission);
  const previous = (await db.get("SELECT value FROM settings WHERE key = ?", [key]) as { value: string } | undefined)?.value ?? "";
  await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key,
    value.slice(0, 500)]);
  await writeAudit(db, actor, {
    action: "update_setting",
    reason,
    targetType: "setting",
    targetId: null,
    previousState: `${key}=${previous}`,
    newState: `${key}=${value.slice(0, 500)}`,
  });
}

export async function listStaff(db: Db, actor: StaffActor) {
  await gate(db, actor, "manage_staff");
  const staff = (await listUsers(db)).filter((user) => user.role !== "user");
  return Promise.all(staff.map(async (user) => ({ user, permissions: await listPermissions(db, user.id) })));
}

export async function createStaffAccount(db: Db,
  actor: StaffActor,
  input: {
    username: string;
    displayName: string;
    role: string;
    permissions: string[];
    reason: string;
  },
) {
  await gate(db, actor, "create_staff_accounts");
  if (!isRole(input.role) || input.role === "user") throw new Error("Choose a staff role label.");
  if (input.role === "founder" && !await hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("Administrator is not the owner. Only the founder seat can name another founder.");
  }
  // Staff seats go to people who already signed up, so every staff member signs in with their own password.
  const username = input.username.trim().toLowerCase().replace(/^@/, "");
  const person = await getUserByUsername(db, username);
  if (!person) throw new Error("No one uses that username. They need to sign up first.");
  if (person.role !== "user") throw new Error(`${person.displayName} already holds a staff seat. Change it from their row instead.`);
  if (person.suspended) throw new Error("That account is suspended.");
  const granted = uniquePermissions(input.permissions);
  await assertGrantable(db, actor, granted);
  const userId = person.id;
  const displayName = input.displayName.trim();
  if (displayName && displayName.length < 2) throw new Error("Give the seat a name people will recognize.");
  await db.run("UPDATE profiles SET role = ?, display_name = ? WHERE id = ?", [
    input.role,
    (displayName || person.displayName).slice(0, 80),
    userId,
  ]);
  await replacePermissions(db, userId, granted);
  await writeAudit(db, actor, {
    action: "create_staff_account",
    reason: input.reason,
    targetType: "user",
    targetId: userId,
    previousState: "user",
    newState: `${input.role}: ${granted.join(", ") || "none"}`,
  });
  return userId;
}

export async function modifyRole(db: Db, actor: StaffActor, userId: number, role: string, reason: string) {
  await gate(db, actor, "modify_roles");
  if (!isRole(role)) throw new Error("Unknown role.");
  if ((role === "founder" || (await hasPermission(db, (await mustUser(db, userId)).id, "platform_ownership"))) && !(await hasPermission(db, actor.id, "platform_ownership"))) {
    throw new Error("Changing the founder seat requires platform ownership.");
  }
  const user = await mustUser(db, userId);
  await db.run("UPDATE profiles SET role = ? WHERE id = ?", [role, userId]);
  await writeAudit(db, actor, {
    action: "modify_role",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: user.role,
    newState: role,
  });
}

export async function modifyPermissions(db: Db,
  actor: StaffActor,
  userId: number,
  permissions: string[],
  reason: string,
) {
  await gate(db, actor, "modify_permissions");
  const user = await mustUser(db, userId);
  const granted = uniquePermissions(permissions);
  if (user.id === actor.id && !granted.includes("modify_permissions") && !await hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("You cannot remove your own permission to modify permissions.");
  }
  await assertGrantable(db, actor, granted);
  const previous = await listPermissions(db, userId);
  await replacePermissions(db, userId, granted);
  await writeAudit(db, actor, {
    action: "modify_permissions",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: previous.join(", ") || "none",
    newState: granted.join(", ") || "none",
  });
}

function uniquePermissions(values: string[]) {
  const granted = [...new Set(values.filter(isPermission))];
  return PERMISSIONS.filter((permission) => granted.includes(permission));
}

async function assertGrantable(db: Db, actor: StaffActor, granted: readonly string[]) {
  for (const permission of granted) {
    if (permission === "platform_ownership" && !await hasPermission(db, actor.id, "platform_ownership")) {
      throw new Error("Platform ownership is not an administrator privilege.");
    }
    if (!await hasPermission(db, actor.id, permission)) {
      throw new Error("You can only grant a permission you hold.");
    }
  }
}

async function replacePermissions(db: Db, userId: number, granted: readonly string[]) {
  await db.run("DELETE FROM permissions WHERE user_id = ?", [userId]);
  for (const permission of granted) {
    await db.run("INSERT INTO permissions (user_id, permission) VALUES (?, ?)", [userId, permission]);
  }
}

export async function lookupPost(db: Db, actor: StaffActor, postId: number) {
  await gate(db, actor, "view_reported_content");
  return await getPost(db, postId);
}

export function roleRank(role: string) {
  const order = ["user", "user_support", "moderator", "senior_moderator", "manager", "director", "administrator", "founder"];
  const index = order.indexOf(role);
  return index === -1 ? 0 : index;
}

export type { Role };
