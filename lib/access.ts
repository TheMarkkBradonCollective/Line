import type { Db } from "./db";

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

/** Moderation grant, memoized for the request. */
function isModerator(db: Db, userId: number) {
  return db.memo(`moderator:${userId}`, async () => {
    const row = await db.get(
      "SELECT 1 AS ok FROM permissions WHERE user_id = ? AND permission IN ('view_reported_content', 'moderate_content') LIMIT 1",
      [userId],
    );
    return Boolean(row);
  });
}

export async function postAccess(db: Db, viewer: number | { id: number }, post: number | PostRef): Promise<Access> {
  const viewerId = typeof viewer === "number" ? viewer : viewer.id;
  const postId = typeof post === "number" ? post : post.id;
  // One round trip: the post's owner and state, a block either way, and a share addressed to the viewer.
  const row = (await db.get(
    `SELECT p.author_id, p.hidden,
            EXISTS (SELECT 1 FROM blocks b
                    WHERE (b.blocker_id = ? AND b.blocked_id = p.author_id)
                       OR (b.blocker_id = p.author_id AND b.blocked_id = ?)) AS blocked,
            EXISTS (SELECT 1 FROM shares s WHERE s.post_id = p.id AND s.to_user_id = ?) AS shared
     FROM posts p WHERE p.id = ?`,
    [viewerId, viewerId, viewerId, postId],
  )) as { author_id: number; hidden: number; blocked: boolean; shared: boolean } | undefined;
  if (!row) return null;
  if (row.author_id === viewerId) return "author";
  if (!row.hidden && !row.blocked && row.shared) return "shared";
  return (await isModerator(db, viewerId)) ? "staff" : null;
}

export async function canViewPost(
  db: Db,
  viewer: number | { id: number },
  post: number | PostRef,
  options: { allowStaff?: boolean } = {},
) {
  const access = await postAccess(db, viewer, post);
  if (access === "author" || access === "shared") return true;
  return Boolean(options.allowStaff && access === "staff");
}

/** Throws the same message whether the post is missing or simply not shared with you. */
export async function requireVisible(db: Db, viewer: number | { id: number }, post: number | PostRef) {
  if (!(await canViewPost(db, viewer, post))) throw new Error("That post isn’t available to you.");
}

/** Profiles are public to signed-in people, except across a block. */
export async function canViewProfile(db: Db, viewerId: number, personId: number) {
  if (viewerId === personId) return true;
  const row = await db.get("SELECT 1 AS ok FROM blocks WHERE blocker_id = ? AND blocked_id = ?", [personId, viewerId]);
  return !row;
}
