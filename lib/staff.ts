import type Database from "better-sqlite3";
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

export function writeAudit(
  db: Database.Database,
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
  db.prepare(
    `INSERT INTO audit_log
      (staff_id, staff_role, action, target_type, target_id, reason, previous_state, new_state, case_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    actor.id,
    actor.role,
    input.action,
    input.targetType ?? null,
    input.targetId ?? null,
    requireReason(input.reason),
    input.previousState ?? null,
    input.newState ?? null,
    input.caseId ?? null,
    new Date().toISOString(),
  );
}

function gate(db: Database.Database, actor: StaffActor, permission: Permission) {
  if (!hasPermission(db, actor.id, permission)) {
    throw new Error("That panel is closed. Your account does not have this permission.");
  }
}

export function searchAccounts(db: Database.Database, actor: StaffActor, query: string) {
  gate(db, actor, "view_user_account");
  const q = query.trim().toLowerCase();
  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE username LIKE ? OR lower(display_name) LIKE ?
       ORDER BY display_name LIMIT 30`,
    )
    .all(`%${q}%`, `%${q}%`) as UserRow[];
  return rows.map((row) => ({
    user: mapUser(row),
    permissions: listPermissions(db, row.id),
  }));
}

export function restrictAccount(db: Database.Database, actor: StaffActor, userId: number, restricted: boolean, reason: string) {
  gate(db, actor, "restrict_accounts");
  const user = mustUser(db, userId);
  if (user.id === actor.id) throw new Error("You cannot restrict your own account.");
  const previous = user.restricted ? "restricted" : "open";
  const next = restricted ? "restricted" : "open";
  db.prepare("UPDATE users SET restricted = ? WHERE id = ?").run(restricted ? 1 : 0, userId);
  writeAudit(db, actor, {
    action: restricted ? "restrict_account" : "lift_restriction",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: previous,
    newState: next,
  });
}

export function suspendAccount(db: Database.Database, actor: StaffActor, userId: number, suspended: boolean, reason: string) {
  gate(db, actor, "suspend_accounts");
  const user = mustUser(db, userId);
  if (user.id === actor.id) throw new Error("You cannot suspend your own account.");
  if (hasPermission(db, user.id, "platform_ownership") && !hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("Only the founder seat can suspend an owner.");
  }
  const previous = user.suspended ? "suspended" : "active";
  const next = suspended ? "suspended" : "active";
  db.prepare("UPDATE users SET suspended = ? WHERE id = ?").run(suspended ? 1 : 0, userId);
  writeAudit(db, actor, {
    action: suspended ? "suspend_account" : "restore_account",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: previous,
    newState: next,
  });
}

export function hidePost(db: Database.Database, actor: StaffActor, postId: number, reason: string) {
  gate(db, actor, "moderate_content");
  const post = getPost(db, postId);
  if (!post) throw new Error("No such post.");
  const why = requireReason(reason);
  db.prepare("UPDATE posts SET hidden = 1, hidden_reason = ? WHERE id = ?").run(why, postId);
  writeAudit(db, actor, {
    action: "hide_content",
    reason: why,
    targetType: "post",
    targetId: postId,
    previousState: post.hidden ? "hidden" : "visible",
    newState: "hidden",
  });
}

export function restorePost(db: Database.Database, actor: StaffActor, postId: number, reason: string) {
  gate(db, actor, "moderate_content");
  const post = getPost(db, postId);
  if (!post) throw new Error("No such post.");
  db.prepare("UPDATE posts SET hidden = 0, hidden_reason = NULL WHERE id = ?").run(postId);
  writeAudit(db, actor, {
    action: "restore_content",
    reason,
    targetType: "post",
    targetId: postId,
    previousState: post.hidden ? "hidden" : "visible",
    newState: "visible",
  });
}

export function createReport(
  db: Database.Database,
  reporterId: number,
  input: { targetType: string; targetId: number; category: string; details: string },
) {
  const types = new Set(["post", "video", "profile", "message", "account"]);
  const categories = new Set(["harassment", "spam", "abuse", "other"]);
  if (!types.has(input.targetType)) throw new Error("Choose what you are reporting.");
  if (!categories.has(input.category)) throw new Error("Choose a reason.");
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO reports
        (reporter_id, target_type, target_id, category, details, status, queue, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', 'moderator', ?, ?)`,
    )
    .run(reporterId, input.targetType, input.targetId, input.category, input.details.trim().slice(0, 1000), now, now);
  return Number(info.lastInsertRowid);
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

function mapReport(
  db: Database.Database,
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
): ReportRecord {
  let targetLabel = `${row.target_type} #${row.target_id}`;
  if (row.target_type === "post" || row.target_type === "video") {
    const post = getPost(db, row.target_id);
    if (post) {
      const author = getUserById(db, post.authorId);
      targetLabel = `${post.kind} by ${author?.displayName ?? "someone"}: ${post.body.slice(0, 80)}`;
    }
  } else if (row.target_type === "profile" || row.target_type === "account" || row.target_type === "message") {
    const user = getUserById(db, row.target_id);
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

export function listReports(db: Database.Database, actor: StaffActor) {
  const queues = queuesForPermissions(listPermissions(db, actor.id));
  if (queues.length === 0) return [];
  const placeholders = queues.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT r.*, u.display_name AS reporter_name
       FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE r.queue IN (${placeholders}) AND r.status != 'resolved'
       ORDER BY r.updated_at DESC`,
    )
    .all(...queues) as Parameters<typeof mapReport>[1][];
  return rows.map((row) => mapReport(db, row));
}

export function listResolvedReports(db: Database.Database, actor: StaffActor) {
  if (!hasPermission(db, actor.id, "review_reports") && !hasPermission(db, actor.id, "access_audit_logs")) {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT r.*, u.display_name AS reporter_name
       FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE r.status = 'resolved'
       ORDER BY r.updated_at DESC LIMIT 20`,
    )
    .all() as Parameters<typeof mapReport>[1][];
  return rows.map((row) => mapReport(db, row));
}

function reportRow(db: Database.Database, id: number) {
  return db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
    | { id: number; queue: Queue; status: string; target_type: string; target_id: number }
    | undefined;
}

function assertQueueAccess(db: Database.Database, actor: StaffActor, queue: Queue) {
  const queues = queuesForPermissions(listPermissions(db, actor.id));
  if (!queues.includes(queue)) {
    throw new Error("This case is in a queue your permissions do not open.");
  }
}

export function escalateReport(db: Database.Database, actor: StaffActor, reportId: number, reason: string, toQueue?: Queue) {
  const report = reportRow(db, reportId);
  if (!report || report.status === "resolved") throw new Error("That case is not open.");
  assertQueueAccess(db, actor, report.queue);
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
  db.prepare("UPDATE reports SET queue = ?, status = 'escalated', updated_at = ? WHERE id = ?").run(next, now, reportId);
  writeAudit(db, actor, {
    action: "escalate_report",
    reason: why,
    targetType: report.target_type,
    targetId: report.target_id,
    previousState: report.queue,
    newState: next,
    caseId: reportId,
  });
}

export function resolveReport(db: Database.Database, actor: StaffActor, reportId: number, reason: string) {
  const report = reportRow(db, reportId);
  if (!report || report.status === "resolved") throw new Error("That case is already closed.");
  assertQueueAccess(db, actor, report.queue);
  const why = requireReason(reason);
  const now = new Date().toISOString();
  db.prepare("UPDATE reports SET status = 'resolved', resolution = ?, updated_at = ? WHERE id = ?").run(why, now, reportId);
  writeAudit(db, actor, {
    action: "resolve_report",
    reason: why,
    targetType: report.target_type,
    targetId: report.target_id,
    previousState: report.status,
    newState: "resolved",
    caseId: reportId,
  });
}

export function listTickets(db: Database.Database, actor: StaffActor) {
  gate(db, actor, "manage_support_tickets");
  return db
    .prepare(
      `SELECT t.*, u.display_name AS user_name, u.username
       FROM tickets t JOIN users u ON u.id = t.user_id
       ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, t.created_at DESC`,
    )
    .all() as {
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

export function updateTicket(db: Database.Database, actor: StaffActor, ticketId: number, status: string, reason: string) {
  gate(db, actor, "manage_support_tickets");
  if (!["open", "pending", "closed"].includes(status)) throw new Error("Unknown ticket status.");
  const ticket = db.prepare("SELECT id, status, user_id FROM tickets WHERE id = ?").get(ticketId) as
    | { id: number; status: string; user_id: number }
    | undefined;
  if (!ticket) throw new Error("No such ticket.");
  db.prepare("UPDATE tickets SET status = ?, assignee_id = ? WHERE id = ?").run(status, actor.id, ticketId);
  writeAudit(db, actor, {
    action: "update_ticket",
    reason,
    targetType: "ticket",
    targetId: ticketId,
    previousState: ticket.status,
    newState: status,
  });
}

export function listAudit(db: Database.Database, actor: StaffActor) {
  gate(db, actor, "access_audit_logs");
  return db
    .prepare(
      `SELECT a.*, u.display_name AS staff_name, u.username AS staff_username
       FROM audit_log a JOIN users u ON u.id = a.staff_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT 200`,
    )
    .all() as {
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
  discover_enabled: "manage_platform_settings",
  signups_open: "manage_platform_settings",
  staff_reason_required: "manage_security_settings",
  billing_note: "manage_financial_settings",
  sharing_paused: "access_emergency_controls",
  ownership_note: "platform_ownership",
  security_note: "manage_security_settings",
};

export function updateSetting(db: Database.Database, actor: StaffActor, key: string, value: string, reason: string) {
  const permission = SETTING_GATES[key];
  if (!permission) throw new Error("That setting is not editable.");
  gate(db, actor, permission);
  const previous = (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? "";
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    value.slice(0, 500),
  );
  writeAudit(db, actor, {
    action: "update_setting",
    reason,
    targetType: "setting",
    targetId: null,
    previousState: `${key}=${previous}`,
    newState: `${key}=${value.slice(0, 500)}`,
  });
}

export function listStaff(db: Database.Database, actor: StaffActor) {
  gate(db, actor, "manage_staff");
  return listUsers(db)
    .filter((user) => user.role !== "user")
    .map((user) => ({ user, permissions: listPermissions(db, user.id) }));
}

export function createStaffAccount(
  db: Database.Database,
  actor: StaffActor,
  input: {
    username: string;
    displayName: string;
    role: string;
    permissions: string[];
    reason: string;
  },
) {
  gate(db, actor, "create_staff_accounts");
  if (!isRole(input.role) || input.role === "user") throw new Error("Choose a staff role label.");
  if (input.role === "founder" && !hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("Administrator is not the owner. Only the founder seat can name another founder.");
  }
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9.]{3,32}$/.test(username)) throw new Error("Usernames are lowercase letters, numbers, and dots.");
  if (getUserByUsername(db, username)) throw new Error("That username is taken.");
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Give the account a name.");
  const granted = uniquePermissions(input.permissions);
  assertGrantable(db, actor, granted);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const info = db
    .prepare(
      `INSERT INTO users
        (username, display_name, bio, avatar_color, initials, role, who_can_share, who_can_add, who_can_reshare, default_visibility, created_at)
       VALUES (?, ?, ?, '#24527a', ?, ?, 'friends', 'everyone', 'recipients', 'private', ?)`,
    )
    .run(
      username,
      displayName.slice(0, 80),
      "Staff account. Access comes from explicit permissions.",
      initials || "S",
      input.role,
      new Date().toISOString(),
    );
  const userId = Number(info.lastInsertRowid);
  replacePermissions(db, userId, granted);
  writeAudit(db, actor, {
    action: "create_staff_account",
    reason: input.reason,
    targetType: "user",
    targetId: userId,
    previousState: "absent",
    newState: `${input.role}: ${granted.join(", ") || "none"}`,
  });
  return userId;
}

export function modifyRole(db: Database.Database, actor: StaffActor, userId: number, role: string, reason: string) {
  gate(db, actor, "modify_roles");
  if (!isRole(role)) throw new Error("Unknown role.");
  if ((role === "founder" || hasPermission(db, mustUser(db, userId).id, "platform_ownership")) && !hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("Changing the founder seat requires platform ownership.");
  }
  const user = mustUser(db, userId);
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  writeAudit(db, actor, {
    action: "modify_role",
    reason,
    targetType: "user",
    targetId: userId,
    previousState: user.role,
    newState: role,
  });
}

export function modifyPermissions(
  db: Database.Database,
  actor: StaffActor,
  userId: number,
  permissions: string[],
  reason: string,
) {
  gate(db, actor, "modify_permissions");
  const user = mustUser(db, userId);
  const granted = uniquePermissions(permissions);
  if (user.id === actor.id && !granted.includes("modify_permissions") && !hasPermission(db, actor.id, "platform_ownership")) {
    throw new Error("You cannot remove your own permission to modify permissions.");
  }
  assertGrantable(db, actor, granted);
  const previous = listPermissions(db, userId);
  replacePermissions(db, userId, granted);
  writeAudit(db, actor, {
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

function assertGrantable(db: Database.Database, actor: StaffActor, granted: readonly string[]) {
  for (const permission of granted) {
    if (permission === "platform_ownership" && !hasPermission(db, actor.id, "platform_ownership")) {
      throw new Error("Platform ownership is not an administrator privilege.");
    }
    if (!hasPermission(db, actor.id, permission)) {
      throw new Error("You can only grant a permission you hold.");
    }
  }
}

function replacePermissions(db: Database.Database, userId: number, granted: readonly string[]) {
  db.prepare("DELETE FROM permissions WHERE user_id = ?").run(userId);
  const insert = db.prepare("INSERT INTO permissions (user_id, permission) VALUES (?, ?)");
  for (const permission of granted) insert.run(userId, permission);
}

export function lookupPost(db: Database.Database, actor: StaffActor, postId: number) {
  gate(db, actor, "view_reported_content");
  return getPost(db, postId);
}

export function roleRank(role: string) {
  const order = ["user", "user_support", "moderator", "senior_moderator", "manager", "director", "administrator", "founder"];
  const index = order.indexOf(role);
  return index === -1 ? 0 : index;
}

export type { Role };
