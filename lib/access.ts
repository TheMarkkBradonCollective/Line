import type Database from "better-sqlite3";

/**
 * The one rule: no share, no see.
 *
 * A person can see a post when they made it, or when a share row is addressed to them
 * (sent directly, through a group or list they are in, or passed down a reshare chain).
 * Every feed, profile tab, post page, reel, comment thread, reaction, and media URL goes
 * through postAccess / canViewPost. The UI never decides this on its own.
 *
 * Staff with moderation grants may open a post as a case file (allowStaff). That never
 * puts the post in their feed, on a profile, or in Reels.
 */

export type Access = "author" | "shared" | "staff" | null;

type PostRef = { id: number; authorId: number; hidden: number };

function isModerator(db: Database.Database, userId: number) {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM permissions WHERE user_id = ? AND permission IN ('view_reported_content', 'moderate_content') LIMIT 1",
    )
    .get(userId) as { ok: number } | undefined;
  return Boolean(row);
}

function blockedEitherWay(db: Database.Database, a: number, b: number) {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1",
    )
    .get(a, b, b, a) as { ok: number } | undefined;
  return Boolean(row);
}

function sharedTo(db: Database.Database, postId: number, userId: number) {
  const row = db.prepare("SELECT 1 AS ok FROM shares WHERE post_id = ? AND to_user_id = ? LIMIT 1").get(postId, userId) as
    | { ok: number }
    | undefined;
  return Boolean(row);
}

function loadPost(db: Database.Database, postId: number): PostRef | null {
  const row = db.prepare("SELECT id, author_id, hidden FROM posts WHERE id = ?").get(postId) as
    | { id: number; author_id: number; hidden: number }
    | undefined;
  return row ? { id: row.id, authorId: row.author_id, hidden: row.hidden } : null;
}

export function postAccess(db: Database.Database, viewer: number | { id: number }, post: number | PostRef): Access {
  const viewerId = typeof viewer === "number" ? viewer : viewer.id;
  const ref = typeof post === "number" ? loadPost(db, post) : post;
  if (!ref) return null;
  if (ref.authorId === viewerId) return "author";
  const staff = isModerator(db, viewerId);
  if (ref.hidden) return staff ? "staff" : null;
  if (blockedEitherWay(db, viewerId, ref.authorId)) return staff ? "staff" : null;
  if (sharedTo(db, ref.id, viewerId)) return "shared";
  return staff ? "staff" : null;
}

export function canViewPost(
  db: Database.Database,
  viewer: number | { id: number },
  post: number | PostRef,
  options: { allowStaff?: boolean } = {},
) {
  const access = postAccess(db, viewer, post);
  if (access === "author" || access === "shared") return true;
  return Boolean(options.allowStaff && access === "staff");
}

/** Throws the same message whether the post is missing or simply not shared with you. */
export function requireVisible(db: Database.Database, viewer: number | { id: number }, post: number | PostRef) {
  if (!canViewPost(db, viewer, post)) throw new Error("That post isn’t available to you.");
}

/** Profiles are public to signed-in people, except across a block. */
export function canViewProfile(db: Database.Database, viewerId: number, personId: number) {
  if (viewerId === personId) return true;
  const row = db.prepare("SELECT 1 AS ok FROM blocks WHERE blocker_id = ? AND blocked_id = ?").get(personId, viewerId) as
    | { ok: number }
    | undefined;
  return !row;
}
