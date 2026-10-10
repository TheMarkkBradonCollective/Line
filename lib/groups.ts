import type { Db } from "./db";
import { canViewPost, postAccess } from "./access";
import { areFriends, canShareWith, engagementMany, getPost, isBlocked, mustUser, usersByIds, type Engagement } from "./social";
import type { Post, PostRow, User } from "./types";
import { mapPost, profileImageUrl } from "./types";

/**
 * Groups: a set of people with a shared feed.
 *
 * - Only members see a group, its members and its feed.
 * - Admins add people from their own friends (no strangers), remove members, rename, set a photo.
 *   The owner can also promote admins and delete the group.
 * - A post shared into a group is visible to members who were already in the group at that moment,
 *   for as long as they stay. Joining later never reveals older group posts. Leaving ends access
 *   that came through the group.
 * - Comments made in the group form a members-only thread, separate from the post's other comments.
 * - A member can pass a group post on to their own friends (if the author allows resharing); that is a
 *   normal Home share and never carries the group thread.
 */

export type GroupRole = "owner" | "admin" | "member";
export type Group = { id: number; name: string; about: string; photoUrl: string | null; photoPath: string | null; createdAt: string; memberCount: number };
export type GroupMember = { user: User; role: GroupRole; joinedAt: string; muted: boolean };

type GroupRow = { id: number; name: string; about: string; photo_path: string | null; created_at: string; member_count?: number };
const mapGroup = (row: GroupRow): Group => ({
  id: row.id,
  name: row.name,
  about: row.about,
  photoPath: row.photo_path,
  photoUrl: profileImageUrl(row.photo_path),
  createdAt: row.created_at,
  memberCount: Number(row.member_count ?? 0),
});

export async function membership(db: Db, groupId: number, userId: number) {
  return (await db.get("SELECT role, joined_at, muted FROM line_group_members WHERE group_id = ? AND user_id = ?", [groupId, userId])) as
    | { role: GroupRole; joined_at: string; muted: number }
    | undefined;
}

async function requireRole(db: Db, groupId: number, userId: number, roles: GroupRole[]) {
  const m = await membership(db, groupId, userId);
  if (!m) throw new Error("That group isn’t available to you.");
  if (!roles.includes(m.role)) throw new Error("Only a group admin can do that.");
  return m;
}

function cleanName(name: string) {
  const value = name.trim().replace(/\s+/g, " ");
  if (!value) throw new Error("Give the group a name.");
  if (value.length > 60) throw new Error("Keep the group name under 60 characters.");
  return value;
}

export async function createCommunity(db: Db, ownerId: number, input: { name: string; about?: string; memberIds?: number[] }) {
  const owner = await mustUser(db, ownerId);
  if (owner.suspended || owner.restricted) throw new Error("Your account can’t create groups right now.");
  const name = cleanName(input.name);
  return db.tx(async (db) => {
    const id = await db.insert("INSERT INTO line_groups (name, about, created_by) VALUES (?, ?, ?)", [name, (input.about ?? "").trim().slice(0, 300), ownerId]);
    await db.run("INSERT INTO line_group_members (group_id, user_id, role) VALUES (?, ?, 'owner')", [id, ownerId]);
    for (const memberId of [...new Set(input.memberIds ?? [])]) {
      if (memberId === ownerId) continue;
      await addMemberUnchecked(db, id, ownerId, memberId);
    }
    return id;
  });
}

async function addMemberUnchecked(db: Db, groupId: number, adderId: number, userId: number) {
  if (!(await areFriends(db, adderId, userId))) throw new Error("You can only add your friends to a group.");
  if (await isBlocked(db, adderId, userId)) throw new Error("A block stops that.");
  await db.run(
    "INSERT INTO line_group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?) ON CONFLICT (group_id, user_id) DO NOTHING",
    [groupId, userId, new Date().toISOString()],
  );
  await db.run(
    "INSERT INTO notifications (user_id, kind, actor_id, group_id, read, created_at) VALUES (?, 'added_to_group', ?, ?, 0, ?)",
    [userId, adderId, groupId, new Date().toISOString()],
  );
}

export async function addGroupMember(db: Db, adminId: number, groupId: number, userId: number) {
  await requireRole(db, groupId, adminId, ["owner", "admin"]);
  if (await membership(db, groupId, userId)) throw new Error("They’re already in this group.");
  await addMemberUnchecked(db, groupId, adminId, userId);
}

export async function removeGroupMember(db: Db, adminId: number, groupId: number, userId: number) {
  const me = await requireRole(db, groupId, adminId, ["owner", "admin"]);
  const them = await membership(db, groupId, userId);
  if (!them) return;
  if (them.role === "owner") throw new Error("The owner can’t be removed.");
  if (them.role === "admin" && me.role !== "owner") throw new Error("Only the owner can remove an admin.");
  await db.run("DELETE FROM line_group_members WHERE group_id = ? AND user_id = ?", [groupId, userId]);
}

export async function setGroupRole(db: Db, ownerId: number, groupId: number, userId: number, role: "admin" | "member") {
  await requireRole(db, groupId, ownerId, ["owner"]);
  const them = await membership(db, groupId, userId);
  if (!them || them.role === "owner") throw new Error("Pick a member.");
  await db.run("UPDATE line_group_members SET role = ? WHERE group_id = ? AND user_id = ?", [role, groupId, userId]);
}

export async function renameGroup(db: Db, adminId: number, groupId: number, name: string, about?: string) {
  await requireRole(db, groupId, adminId, ["owner", "admin"]);
  await db.run("UPDATE line_groups SET name = ?, about = COALESCE(?, about) WHERE id = ?", [cleanName(name), about === undefined ? null : about.trim().slice(0, 300), groupId]);
}

/** Returns the previous photo path so the caller can remove the file. */
export async function setGroupPhoto(db: Db, adminId: number, groupId: number, path: string | null) {
  await requireRole(db, groupId, adminId, ["owner", "admin"]);
  const row = (await db.get("SELECT photo_path FROM line_groups WHERE id = ?", [groupId])) as { photo_path: string | null };
  await db.run("UPDATE line_groups SET photo_path = ? WHERE id = ?", [path, groupId]);
  return row.photo_path;
}

/** Leave. If the owner leaves, the longest-serving admin (or member) becomes owner; an empty group is deleted. */
export async function leaveGroup(db: Db, userId: number, groupId: number) {
  const me = await membership(db, groupId, userId);
  if (!me) return { deleted: false };
  return db.tx(async (db) => {
    await db.run("DELETE FROM line_group_members WHERE group_id = ? AND user_id = ?", [groupId, userId]);
    if (me.role !== "owner") return { deleted: false };
    const next = (await db.get(
      "SELECT user_id FROM line_group_members WHERE group_id = ? ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, joined_at, user_id LIMIT 1",
      [groupId],
    )) as { user_id: number } | undefined;
    if (!next) {
      await db.run("DELETE FROM line_groups WHERE id = ?", [groupId]);
      return { deleted: true };
    }
    await db.run("UPDATE line_group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?", [groupId, next.user_id]);
    return { deleted: false };
  });
}

/** Owner only. Group posts, group threads and memberships go with it; the posts themselves stay with their authors. */
export async function deleteCommunity(db: Db, ownerId: number, groupId: number) {
  await requireRole(db, groupId, ownerId, ["owner"]);
  const row = (await db.get("SELECT photo_path FROM line_groups WHERE id = ?", [groupId])) as { photo_path: string | null };
  await db.run("DELETE FROM line_groups WHERE id = ?", [groupId]);
  return row.photo_path;
}

export async function setGroupMuted(db: Db, userId: number, groupId: number, muted: boolean) {
  await requireRole(db, groupId, userId, ["owner", "admin", "member"]);
  await db.run("UPDATE line_group_members SET muted = ? WHERE group_id = ? AND user_id = ?", [muted ? 1 : 0, groupId, userId]);
}

export async function listMyCommunities(db: Db, userId: number) {
  const rows = (await db.all(
    `SELECT g.*, m.role, m.muted, (SELECT COUNT(*) FROM line_group_members x WHERE x.group_id = g.id) AS member_count,
            (SELECT MAX(gp.created_at) FROM group_posts gp WHERE gp.group_id = g.id AND gp.created_at >= m.joined_at) AS last_at
     FROM line_group_members m JOIN line_groups g ON g.id = m.group_id
     WHERE m.user_id = ?
     ORDER BY COALESCE((SELECT MAX(gp.created_at) FROM group_posts gp WHERE gp.group_id = g.id), g.created_at) DESC`,
    [userId],
  )) as (GroupRow & { role: GroupRole; muted: number; last_at: string | null })[];
  return rows.map((row) => ({ ...mapGroup(row), role: row.role, muted: Boolean(row.muted), lastAt: row.last_at }));
}

/** The group, the viewer's role and the member list. Null for non-members (same as missing). */
export async function getCommunity(db: Db, viewerId: number, groupId: number) {
  const me = await membership(db, groupId, viewerId);
  if (!me) return null;
  const row = (await db.get(
    "SELECT g.*, (SELECT COUNT(*) FROM line_group_members x WHERE x.group_id = g.id) AS member_count FROM line_groups g WHERE g.id = ?",
    [groupId],
  )) as GroupRow | undefined;
  if (!row) return null;
  const memberRows = (await db.all(
    "SELECT user_id, role, joined_at, muted FROM line_group_members WHERE group_id = ? ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, joined_at",
    [groupId],
  )) as { user_id: number; role: GroupRole; joined_at: string; muted: number }[];
  const users = await usersByIds(db, memberRows.map((r) => r.user_id));
  const members: GroupMember[] = memberRows.map((r, i) => ({ user: users[i], role: r.role, joinedAt: r.joined_at, muted: Boolean(r.muted) }));
  return { group: mapGroup(row), role: me.role, joinedAt: me.joined_at, muted: Boolean(me.muted), members };
}

/**
 * Share a post into a group. The sharer must be a member and able to see the post; anyone but the
 * author also needs the author's resharing permission (same checks as a reshare).
 */
export async function shareToGroup(db: Db, userId: number, groupId: number, postId: number, note?: string | null) {
  if (!(await membership(db, groupId, userId))) throw new Error("You’re not in that group.");
  const post = await getPost(db, postId);
  if (!post || !(await canViewPost(db, userId, post))) throw new Error("That post isn’t available to you.");
  const sharer = await mustUser(db, userId);
  if (sharer.suspended || sharer.restricted) throw new Error("Your account cannot share right now.");
  if (post.authorId !== userId) {
    const decision = await canShareWith(db, userId, userId, post);
    if (!decision.ok) throw new Error(decision.reason);
  }
  const existing = await db.get("SELECT id FROM group_posts WHERE group_id = ? AND post_id = ?", [groupId, postId]);
  if (existing) throw new Error("That post is already in this group.");
  const when = new Date().toISOString();
  const id = await db.insert("INSERT INTO group_posts (group_id, post_id, shared_by, note, created_at) VALUES (?, ?, ?, ?, ?)", [
    groupId,
    postId,
    userId,
    note?.trim() ? note.trim().slice(0, 200) : null,
    when,
  ]);
  // Tell members who haven't muted the group (and aren't across a block from the sharer).
  await db.run(
    `INSERT INTO notifications (user_id, kind, actor_id, post_id, group_id, read, created_at)
     SELECT m.user_id, 'group_post', ?, ?, ?, 0, ? FROM line_group_members m
     WHERE m.group_id = ? AND m.user_id <> ? AND m.muted = 0
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = m.user_id AND b.blocked_id = ?) OR (b.blocker_id = ? AND b.blocked_id = m.user_id))`,
    [userId, postId, groupId, when, groupId, userId, userId, userId],
  );
  return id;
}

/** Remove a post from a group: whoever shared it, the post's author, or an admin. */
export async function removeGroupPost(db: Db, userId: number, groupId: number, postId: number) {
  const m = await membership(db, groupId, userId);
  const row = (await db.get(
    "SELECT gp.shared_by, p.author_id FROM group_posts gp JOIN posts p ON p.id = gp.post_id WHERE gp.group_id = ? AND gp.post_id = ?",
    [groupId, postId],
  )) as { shared_by: number; author_id: number } | undefined;
  if (!row) return;
  const allowed = row.author_id === userId || (m && (row.shared_by === userId || m.role !== "member"));
  if (!allowed) throw new Error("Only the sharer, the author or an admin can remove it.");
  await db.run("DELETE FROM comments WHERE post_id = ? AND group_id = ?", [postId, groupId]);
  await db.run("DELETE FROM group_posts WHERE group_id = ? AND post_id = ?", [groupId, postId]);
}

/** Can this person read and write the group thread on this post? Current member, joined before it was shared, and can see the post. */
export async function canUseGroupThread(db: Db, viewerId: number, groupId: number, postId: number) {
  const row = await db.get(
    `SELECT 1 AS ok FROM group_posts gp JOIN line_group_members m ON m.group_id = gp.group_id AND m.user_id = ?
     WHERE gp.group_id = ? AND gp.post_id = ? AND m.joined_at <= gp.created_at`,
    [viewerId, groupId, postId],
  );
  if (!row) return false;
  return canViewPost(db, viewerId, postId);
}

export type GroupFeedItem = Engagement & {
  post: Post;
  author: User;
  sharedBy: User;
  note: string | null;
  at: string;
  threadCount: number;
};

/** Posts in the group the viewer may see: shared after they joined, still visible to them, not hidden by them. */
export async function groupFeed(db: Db, viewerId: number, groupId: number): Promise<GroupFeedItem[] | null> {
  const me = await membership(db, groupId, viewerId);
  if (!me) return null;
  const rows = (await db.all(
    `SELECT p.*, gp.shared_by AS gp_by, gp.note AS gp_note, gp.created_at AS gp_at,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.group_id = gp.group_id
               AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = c.author_id) OR (b.blocker_id = c.author_id AND b.blocked_id = ?))) AS thread_count
     FROM group_posts gp JOIN posts p ON p.id = gp.post_id
     WHERE gp.group_id = ? AND gp.created_at >= ?
       AND NOT EXISTS (SELECT 1 FROM hidden_posts h WHERE h.user_id = ? AND h.post_id = p.id)
     ORDER BY gp.created_at DESC, gp.id DESC LIMIT 100`,
    [viewerId, viewerId, groupId, me.joined_at, viewerId],
  )) as (PostRow & { gp_by: number; gp_note: string | null; gp_at: string; thread_count: number })[];
  const ok = await Promise.all(rows.map((row) => postAccess(db, viewerId, { id: row.id, authorId: row.author_id, hidden: row.hidden })));
  const visible = rows.filter((_, i) => ok[i] && ok[i] !== "staff");
  const counts = await engagementMany(db, visible.map((r) => r.id), viewerId);
  const authors = await usersByIds(db, visible.map((r) => r.author_id));
  const sharers = await usersByIds(db, visible.map((r) => r.gp_by));
  return visible.map((row, i) => ({
    ...counts.get(row.id)!,
    post: mapPost(row),
    author: authors[i],
    sharedBy: sharers[i],
    note: row.gp_note,
    at: row.gp_at,
    threadCount: Number(row.thread_count),
  }));
}

/** Groups the viewer could share this post into (member, and the post isn't there yet). */
export async function groupTargets(db: Db, viewerId: number, postId: number | null) {
  const rows = (await db.all(
    `SELECT g.id, g.name, g.photo_path, (SELECT COUNT(*) FROM line_group_members x WHERE x.group_id = g.id) AS member_count,
            ${postId ? "EXISTS (SELECT 1 FROM group_posts gp WHERE gp.group_id = g.id AND gp.post_id = ?)" : "false"} AS has_it
     FROM line_group_members m JOIN line_groups g ON g.id = m.group_id WHERE m.user_id = ? ORDER BY g.name`,
    postId ? [postId, viewerId] : [viewerId],
  )) as { id: number; name: string; photo_path: string | null; member_count: number; has_it: boolean }[];
  return rows.map((r) => ({ id: r.id, name: r.name, photoUrl: profileImageUrl(r.photo_path), memberCount: Number(r.member_count), hasIt: Boolean(r.has_it) }));
}
