import type { Db } from "./db";
import { v3Ready } from "./schema-ready";

/**
 * The one rule: no share, no see.
 *
 * A person can see a post when they made it, or when a share row is addressed to them
 * (sent directly, through a group or list they are in, or passed down a reshare chain).
 * Every feed, profile tab, post page, reel, comment thread, reaction, and media URL goes
 * through postAccess / canViewPost. The UI never decides this on its own.
 *
 * A post the author sent to "Followers" is also visible to anyone who currently follows the author.
 * Only the author can use that audience; following never allows direct shares.
 *
 * A post shared into a group is visible to members who were in the group when it was shared,
 * for as long as they stay members. Its comments there form a members-only group thread.
 *
 * Staff with moderation grants may open a post as a case file (allowStaff). That never
 * puts the post in their feed, on a profile, or in Reels.
 */

export type Access = "author" | "shared" | "follower" | "group" | "staff" | null;

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
  const groups = await v3Ready(db);
  const row = (await db.get(
    `SELECT p.author_id, p.hidden,
            EXISTS (SELECT 1 FROM blocks b
                    WHERE (b.blocker_id = ? AND b.blocked_id = p.author_id)
                       OR (b.blocker_id = p.author_id AND b.blocked_id = ?)) AS blocked,
            EXISTS (SELECT 1 FROM shares s WHERE s.post_id = p.id AND s.to_user_id = ?) AS shared,
            EXISTS (SELECT 1 FROM follower_shares fs
                    JOIN follows f ON f.followee_id = fs.from_user_id AND f.follower_id = ?
                    WHERE fs.post_id = p.id AND fs.from_user_id = p.author_id) AS followed,
            ${groups ? `EXISTS (SELECT 1 FROM group_posts gp
                    JOIN line_group_members m ON m.group_id = gp.group_id AND m.user_id = ? AND m.joined_at <= gp.created_at
                    WHERE gp.post_id = p.id)` : "(?::int IS NULL AND false)"} AS grouped
     FROM posts p WHERE p.id = ?`,
    [viewerId, viewerId, viewerId, viewerId, viewerId, postId],
  )) as { author_id: number; hidden: number; blocked: boolean; shared: boolean; followed: boolean; grouped: boolean } | undefined;
  if (!row) return null;
  if (row.author_id === viewerId) return "author";
  if (!row.hidden && !row.blocked && row.shared) return "shared";
  // The author sent it to Followers and the viewer follows the author (now; unfollowing ends it).
  if (!row.hidden && !row.blocked && row.followed) return "follower";
  // Shared into a group the viewer belongs to, and they were already a member when it was shared. Leaving ends it.
  if (!row.hidden && !row.blocked && row.grouped) return "group";
  // Staff can open a post only as a case file: they hold a moderation grant AND the post has been reported.
  if (!(await isModerator(db, viewerId))) return null;
  const reported = await db.get(
    "SELECT 1 AS ok FROM reports WHERE target_type IN ('post', 'video') AND target_id = ? LIMIT 1",
    [postId],
  );
  return reported ? "staff" : null;
}

export async function canViewPost(
  db: Db,
  viewer: number | { id: number },
  post: number | PostRef,
  options: { allowStaff?: boolean } = {},
) {
  const access = await postAccess(db, viewer, post);
  if (access === "author" || access === "shared" || access === "follower" || access === "group") return true;
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
