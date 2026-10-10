import type { Db } from "./db";
import { isVideoKind } from "./format";
import { canViewPost, canViewProfile, postAccess } from "./access";
import type { AddPolicy, Frame, Post, PostKind, PostRow, ResharePolicy, SharePolicy, User, UserRow } from "./types";
import { mapPost, mapUser } from "./types";

export { canViewPost, canViewProfile, requireVisible } from "./access";
export { postAccess };

export const REACTION_KINDS = ["like", "love", "haha", "wow", "sad"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type ReactionSummary = {
  total: number;
  mine: ReactionKind | null;
  /** Kinds in use, most common first. */
  top: ReactionKind[];
  counts: Partial<Record<ReactionKind, number>>;
};

export type Engagement = {
  likeCount: number;
  shareCount: number;
  liked: boolean;
  reactions: ReactionSummary;
  commentCount: number;
};

export type TimelineItem = {
  shareId: number;
  postId: number;
  toUserId: number;
  kind: PostKind;
  body: string;
  author: User;
  sharedBy: User;
  shareKind: string;
  groupName: string | null;
  note: string | null;
  sharedAt: string;
  headline: string;
  provenance: string;
  allowReshare: number;
  frames: Frame[];
  /** True when the item is the viewer's own post rather than something addressed to them. */
  ownPost: boolean;
  likeCount: number;
  shareCount: number;
  liked: boolean;
  reactions: ReactionSummary;
  commentCount: number;
  /** Who carried the post here, in order: creator first, the person who sent it to you last. */
  chain: User[];
};

export type ShareRejection = { userId: number; name: string; reason: string };
export type ShareSuccess = { userId: number; shareId: number };

const POST_KINDS = new Set(["text", "photo", "video", "short", "long_video", "reel"]);

export async function getUserById(db: Db, id: number) {
  return db.memo(`user:${id}`, async () => {
    const row = (await db.get("SELECT * FROM profiles WHERE id = ?", [id])) as UserRow | undefined;
    return row ? mapUser(row) : null;
  });
}

/** Many people at once, in the order asked. Unknown ids throw like mustUser. */
export async function usersByIds(db: Db, ids: number[]) {
  return Promise.all(ids.map((id) => mustUser(db, id)));
}

export async function getUserByAuthId(db: Db, authId: string) {
  const row = (await db.get("SELECT * FROM profiles WHERE auth_id = ?", [authId])) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export async function getUserByUsername(db: Db, username: string) {
  const row = await db.get("SELECT * FROM profiles WHERE username = ?", [username]) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export async function mustUser(db: Db, id: number) {
  const user = await getUserById(db, id);
  if (!user) throw new Error("That person is not on LINE.");
  return user;
}

export async function listUsers(db: Db) {
  const rows = await db.all("SELECT * FROM profiles ORDER BY lower(display_name), id") as UserRow[];
  return rows.map(mapUser);
}

export async function getPost(db: Db, id: number) {
  const row = await db.get("SELECT * FROM posts WHERE id = ?", [id]) as PostRow | undefined;
  return row ? mapPost(row) : null;
}

export async function getPostBySeedKey(db: Db, seedKey: string) {
  const row = await db.get("SELECT * FROM posts WHERE seed_key = ?", [seedKey]) as PostRow | undefined;
  return row ? mapPost(row) : null;
}

export async function getSetting(db: Db, key: string) {
  const row = await db.get("SELECT value FROM settings WHERE key = ?", [key]) as { value: string } | undefined;
  return row?.value ?? "";
}

export async function listPermissions(db: Db, userId: number) {
  const rows = await db.all("SELECT permission FROM permissions WHERE user_id = ? ORDER BY permission", [userId]) as {
    permission: string;
  }[];
  return rows.map((row) => row.permission);
}

export async function hasPermission(db: Db, userId: number, permission: string) {
  const row = await db.get("SELECT 1 AS ok FROM permissions WHERE user_id = ? AND permission = ?", [userId, permission]) as { ok: number } | undefined;
  return Boolean(row);
}

export async function areFriends(db: Db, a: number, b: number) {
  if (a === b) return false;
  const row = await db.get(`SELECT 1 AS ok FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`, [a, b, b, a]) as { ok: number } | undefined;
  return Boolean(row);
}

export async function isBlocked(db: Db, a: number, b: number) {
  const row = await db.get(`SELECT 1 AS ok FROM blocks
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`, [a, b, b, a]) as { ok: number } | undefined;
  return Boolean(row);
}

export async function friendIds(db: Db, userId: number) {
  const rows = await db.all(`SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id
       FROM friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`, [userId, userId, userId]) as { id: number }[];
  return rows.map((row) => row.id);
}

export async function listFriends(db: Db, userId: number) {
  const ids = await friendIds(db, userId);
  return (await usersByIds(db, ids)).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function sharesAFriend(db: Db, a: number, b: number) {
  const mine = new Set(await friendIds(db, a));
  return (await friendIds(db, b)).some((id) => mine.has(id));
}

async function inInboundGroup(db: Db, ownerId: number, senderId: number) {
  const row = await db.get(`SELECT 1 AS ok
       FROM friend_groups g
       JOIN friend_group_members m ON m.group_id = g.id
       WHERE g.owner_id = ? AND g.allows_inbound_share = 1 AND m.user_id = ?`, [ownerId, senderId]) as { ok: number } | undefined;
  return Boolean(row);
}

async function onAllowList(db: Db, ownerId: number, senderId: number) {
  const row = await db.get("SELECT 1 AS ok FROM share_allow WHERE user_id = ? AND allowed_id = ?", [ownerId, senderId]) as { ok: number } | undefined;
  return Boolean(row);
}

export async function hasShareTo(db: Db, postId: number, userId: number) {
  const row = await db.get("SELECT 1 AS ok FROM shares WHERE post_id = ? AND to_user_id = ?", [postId, userId]) as { ok: number } | undefined;
  return Boolean(row);
}

export async function canShareWith(db: Db, fromId: number, toId: number, post: Post) {
  if (await getSetting(db, "sharing_paused") === "1") {
    return { ok: false as const, reason: "Sharing is paused." };
  }
  const from = await mustUser(db, fromId);
  const to = await mustUser(db, toId);
  if (from.suspended || from.restricted) {
    return { ok: false as const, reason: "Your account cannot share right now." };
  }
  if (post.hidden) {
    return { ok: false as const, reason: "Moderation removed this, so it cannot be shared." };
  }
  if (!post.allowReshare && post.authorId !== fromId) {
    return { ok: false as const, reason: "The creator turned off resharing." };
  }
  if (fromId !== post.authorId) {
    const author = await mustUser(db, post.authorId);
    if (author.whoCanReshare === "nobody") {
      return { ok: false as const, reason: "The creator does not allow resharing." };
    }
    if (author.whoCanReshare === "friends" && !await areFriends(db, fromId, author.id)) {
      return { ok: false as const, reason: "Only friends of the creator can reshare this." };
    }
    if (author.whoCanReshare === "recipients") {
      if (!await hasShareTo(db, post.id, fromId) && (await postAccess(db, fromId, post)) !== "follower") {
        return { ok: false as const, reason: "You can pass this on only after it was shared with you." };
      }
    }
  }
  if (fromId === toId) return { ok: true as const };
  if (to.suspended) {
    return { ok: false as const, reason: `${to.displayName} is not receiving shares.` };
  }
  if (await isBlocked(db, fromId, toId)) {
    return { ok: false as const, reason: `A block stops sharing with ${to.displayName}.` };
  }
  // Direct shares (people, groups, lists) go to friends only. Following someone never lets you share to them.
  if (!await areFriends(db, fromId, toId)) {
    return { ok: false as const, reason: `You can only share directly with friends. ${to.displayName} isn’t your friend.` };
  }
  if (to.whoCanShare === "nobody") {
    return { ok: false as const, reason: `${to.displayName} is not accepting shares.` };
  }
  if (to.whoCanShare === "friends" && !await areFriends(db, fromId, toId)) {
    return { ok: false as const, reason: `${to.displayName} only accepts shares from friends.` };
  }
  if (to.whoCanShare === "allow_list" && !await onAllowList(db, toId, fromId)) {
    return { ok: false as const, reason: `${to.displayName} has not allowed shares from you.` };
  }
  if (to.whoCanShare === "groups" && !await inInboundGroup(db, toId, fromId)) {
    return { ok: false as const, reason: `${to.displayName} only accepts shares from certain groups.` };
  }
  return { ok: true as const };
}

async function parentShareId(db: Db, post: Post, fromId: number) {
  if (post.authorId === fromId) return null;
  const row = await db.get(`SELECT id FROM shares
       WHERE post_id = ? AND to_user_id = ? AND from_user_id != ?
       ORDER BY id DESC LIMIT 1`, [post.id, fromId, fromId]) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function sharePost(db: Db,
  input: {
    postId: number;
    fromUserId: number;
    recipients: { userId: number; shareKind: "direct" | "group" | "list" | "self"; groupId?: number | null; listId?: number | null }[];
    note?: string | null;
    createdAt?: string;
  },
) {
  const post = await getPost(db, input.postId);
  if (!post) throw new Error("That post is gone.");
  const note = input.note?.trim() ? input.note.trim().slice(0, 200) : null;
  const created: ShareSuccess[] = [];
  const rejected: ShareRejection[] = [];
  const seen = new Set<number>();

  await db.tx(async (db) => {
    for (const recipient of input.recipients) {
      if (seen.has(recipient.userId)) continue;
      seen.add(recipient.userId);
      const person = await getUserById(db, recipient.userId);
      if (!person) {
        rejected.push({ userId: recipient.userId, name: "Someone", reason: "No such person." });
        continue;
      }
      const decision = await canShareWith(db, input.fromUserId, recipient.userId, post);
      if (!decision.ok) {
        rejected.push({ userId: person.id, name: person.displayName, reason: decision.reason });
        continue;
      }
      const existing = await db.get("SELECT id FROM shares WHERE post_id = ? AND from_user_id = ? AND to_user_id = ?", [post.id, input.fromUserId, person.id]) as { id: number } | undefined;
      if (existing) {
        rejected.push({
          userId: person.id,
          name: person.displayName,
          reason: `You already shared this with ${person.displayName}.`,
        });
        continue;
      }
      const when = input.createdAt ?? new Date().toISOString();
      const shareId = await db.insert(`INSERT INTO shares
            (post_id, from_user_id, to_user_id, share_kind, group_id, list_id, parent_share_id, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [post.id,
          input.fromUserId,
          person.id,
          recipient.shareKind,
          recipient.groupId ?? null,
          recipient.listId ?? null,
          await parentShareId(db, post, input.fromUserId),
          note,
          when]);
      created.push({ userId: person.id, shareId });
      if (person.id !== input.fromUserId) {
        await db.run(`INSERT INTO notifications (user_id, kind, actor_id, post_id, share_id, read, created_at)
           VALUES (?, 'shared_with_you', ?, ?, ?, 0, ?)`, [person.id, input.fromUserId, post.id, shareId, when]);
      }
      if (input.fromUserId !== post.authorId) {
        const kind = isVideoKind(post.kind) ? "reshared_video" : "shared_onward";
        await db.run(`INSERT INTO notifications (user_id, kind, actor_id, post_id, share_id, read, created_at)
           VALUES (?, ?, ?, ?, ?, 0, ?)`, [post.authorId, kind, input.fromUserId, post.id, shareId, when]);
      }
    }
  });
  return { created, rejected };
}

export type RecipientChoice = {
  self: boolean;
  /** Send to everyone who follows you (now and later). Only for your own posts. */
  followers?: boolean;
  friendIds: number[];
  groupIds: number[];
  listIds: number[];
};

export async function expandRecipients(db: Db, fromUserId: number, choice: RecipientChoice) {
  const recipients: {
    userId: number;
    shareKind: "direct" | "group" | "list" | "self";
    groupId?: number | null;
    listId?: number | null;
  }[] = [];
  const errors: string[] = [];
  if (choice.self) {
    recipients.push({ userId: fromUserId, shareKind: "self" });
  }
  for (const friendId of choice.friendIds) {
    recipients.push({ userId: friendId, shareKind: "direct" });
  }
  for (const groupId of choice.groupIds) {
    const group = await db.get("SELECT id, name FROM friend_groups WHERE id = ? AND owner_id = ?", [groupId, fromUserId]) as { id: number; name: string } | undefined;
    if (!group) {
      errors.push("One of those groups is not yours.");
      continue;
    }
    const members = await db.all("SELECT user_id FROM friend_group_members WHERE group_id = ?", [groupId]) as {
      user_id: number;
    }[];
    if (members.length === 0) errors.push(`${group.name} has no one in it.`);
    for (const member of members) {
      recipients.push({ userId: member.user_id, shareKind: "group", groupId });
    }
  }
  for (const listId of choice.listIds) {
    const list = await db.get("SELECT id, name FROM friend_lists WHERE id = ? AND owner_id = ?", [listId, fromUserId]) as { id: number; name: string } | undefined;
    if (!list) {
      errors.push("One of those lists is not yours.");
      continue;
    }
    const members = await db.all("SELECT user_id FROM friend_list_members WHERE list_id = ?", [listId]) as {
      user_id: number;
    }[];
    if (members.length === 0) errors.push(`${list.name} has no one in it.`);
    for (const member of members) {
      recipients.push({ userId: member.user_id, shareKind: "list", listId });
    }
  }
  return { recipients, errors };
}

export const MAX_PHOTOS = 6;

/**
 * Uploaded files a post may use: they must sit in the author's own folder of the media bucket
 * and match the kind (images for photo posts, one video for video posts and reels).
 */
export function checkFrames(authorId: number, kind: string, frames: Frame[]) {
  for (const frame of frames) {
    if (!frame.path.startsWith(`u/${authorId}/`) || frame.path.includes("..")) {
      throw new Error("That upload doesn’t belong to you.");
    }
  }
  if (kind === "text") return [];
  if (kind === "photo") {
    if (!frames.length) throw new Error("Add at least one photo.");
    if (frames.some((frame) => !frame.mime.startsWith("image/"))) throw new Error("Photo posts take images only.");
    return frames.slice(0, MAX_PHOTOS);
  }
  if (!frames.length) throw new Error(kind === "reel" ? "Add a video for your reel." : "Add a video.");
  if (frames.length > 1 || !frames[0].mime.startsWith("video/")) throw new Error("Add one video file.");
  return frames;
}

export async function createPost(
  db: Db,
  authorId: number,
  input: {
    kind: string;
    body: string;
    /** Files already uploaded to the media bucket. Required for photo, video and reel posts. */
    frames?: Frame[] | null;
    allowReshare: boolean;
    seedKey?: string | null;
    createdAt?: string;
  },
) {
  const author = await mustUser(db, authorId);
  if (author.suspended || author.restricted) {
    throw new Error("Your account cannot create posts right now.");
  }
  if (!POST_KINDS.has(input.kind)) throw new Error("Choose a kind of post.");
  const body = input.body.trim();
  if (!body && input.kind === "text") throw new Error("Write something first.");
  if (body.length > 2000) throw new Error("Keep it under 2,000 characters.");
  const frames = checkFrames(authorId, input.kind, input.frames ?? []);
  return db.insert(
    `INSERT INTO posts (author_id, kind, body, frames, allow_reshare, hidden, seed_key, created_at)
     VALUES (?, ?, ?, ?::jsonb, ?, 0, ?, ?)`,
    [
      authorId,
      input.kind,
      body,
      JSON.stringify(frames),
      input.allowReshare ? 1 : 0,
      input.seedKey ?? null,
      input.createdAt ?? new Date().toISOString(),
    ],
  );
}

export async function publishPost(db: Db,
  authorId: number,
  input: {
    kind: string;
    body: string;
    frames?: Frame[] | null;
    allowReshare: boolean;
    choice: RecipientChoice;
    note?: string | null;
  },
) {
  const { recipients, errors } = await expandRecipients(db, authorId, input.choice);
  if (recipients.length === 0 && !input.choice.followers) {
    throw new Error("Pick “Just me”, Followers, people, a group, or a list. A post only reaches someone when you share it with them.");
  }
  const postId = await createPost(db, authorId, input);
  if (input.choice.followers) await shareToFollowers(db, postId, authorId, input.note);
  const shared = recipients.length
    ? await sharePost(db, { postId, fromUserId: authorId, recipients, note: input.note })
    : { created: [], rejected: [] };
  return { postId, ...shared, errors, followers: Boolean(input.choice.followers) };
}

/** People who passed a share along between the creator and the sender, oldest first. One query. */
async function passersOf(db: Db, parentId: number | null, author: User, sender: User) {
  if (!parentId) return [] as User[];
  const rows = (await db.all(
    `WITH RECURSIVE up AS (
       SELECT id, from_user_id, parent_share_id, 1 AS depth FROM shares WHERE id = ?
       UNION ALL
       SELECT s.id, s.from_user_id, s.parent_share_id, up.depth + 1
       FROM shares s JOIN up ON s.id = up.parent_share_id
       WHERE up.depth < 50
     )
     SELECT from_user_id FROM up ORDER BY depth`,
    [parentId],
  )) as { from_user_id: number }[];
  const ids = rows.map((row) => row.from_user_id).filter((id) => id !== author.id && id !== sender.id);
  return (await usersByIds(db, ids)).reverse();
}

function provenanceText(author: User, sender: User, viewerId: number, passers: User[]) {
  if (sender.id === viewerId && author.id === viewerId) return "Originally created by you.";
  if (sender.id === viewerId || sender.id === author.id) return `Originally created by ${author.displayName}.`;
  const via = passers.length ? ` Passed along by ${passers.map((item) => item.displayName).join(", then ")}.` : "";
  return `Originally created by ${author.displayName}. Shared with you by ${sender.displayName}.${via}`;
}

type TimelineRow = {
  share_id: number;
  post_id: number;
  from_user_id: number;
  to_user_id: number;
  share_kind: string;
  group_id: number | null;
  parent_share_id: number | null;
  note: string | null;
  shared_at: string;
  kind: PostKind;
  body: string;
  frames: Frame[] | null;
  hidden: number;
  author_id: number;
  allow_reshare: number;
  group_name: string | null;
};

/**
 * Personal timeline. A row exists only because someone addressed a share to this user
 * (including a share they addressed to themselves).
 */
export async function getTimeline(db: Db, userId: number): Promise<TimelineItem[]> {
  const rows = (await db.all(
    `SELECT
       s.id AS share_id, s.post_id, s.from_user_id, s.to_user_id, s.share_kind, s.group_id,
       s.parent_share_id, s.note, s.created_at AS shared_at,
       p.kind, p.body, p.frames, p.hidden, p.author_id, p.allow_reshare,
       g.name AS group_name
     FROM shares s
     JOIN posts p ON p.id = s.post_id
     LEFT JOIN friend_groups g ON g.id = s.group_id
     WHERE s.to_user_id = ?
       AND p.hidden = 0
     ORDER BY s.created_at DESC, s.id DESC`,
    [userId],
  )) as TimelineRow[];
  const counts = await engagementMany(
    db,
    rows.map((row) => row.post_id),
    userId,
  );
  return Promise.all(
    rows.map(async (row) => {
      const [author, sharedBy] = await Promise.all([mustUser(db, row.author_id), mustUser(db, row.from_user_id)]);
      const passers = await passersOf(db, row.parent_share_id, author, sharedBy);
      const self = sharedBy.id === userId;
      let headline = `${sharedBy.displayName} shared this with you.`;
      if (self && author.id === userId && row.share_kind === "self") headline = "You published this to your feed.";
      else if (self) headline = "You shared this onto your feed.";
      const chain = [author, ...passers];
      if (sharedBy.id !== author.id) chain.push(sharedBy);
      return {
        shareId: row.share_id,
        postId: row.post_id,
        toUserId: row.to_user_id,
        kind: row.kind,
        body: row.body,
        author,
        sharedBy,
        shareKind: row.share_kind,
        groupName: row.group_name,
        note: row.note,
        sharedAt: row.shared_at,
        headline,
        provenance: provenanceText(author, sharedBy, userId, passers),
        chain,
        allowReshare: row.allow_reshare,
        frames: mapPost({
          ...row,
          id: row.post_id,
          seed_key: null,
          hidden_reason: null,
          created_at: row.shared_at,
        } as PostRow).frames,
        ownPost: false,
        ...counts.get(row.post_id)!,
      };
    }),
  );
}

/**
 * Home feed: one card per post that reached you (the latest share wins), plus everything you made.
 * Every item passes the same access check as the post page.
 */
export async function getHomeFeed(db: Db, userId: number): Promise<TimelineItem[]> {
  const seen = new Set<number>();
  const items: TimelineItem[] = [];
  for (const item of await getTimeline(db, userId)) {
    if (seen.has(item.postId)) continue;
    seen.add(item.postId);
    items.push(item);
  }
  const me = await mustUser(db, userId);
  const own = (await db.all("SELECT * FROM posts WHERE author_id = ? AND hidden = 0 ORDER BY created_at DESC, id DESC", [
    userId,
  ])) as PostRow[];
  const fresh = own.filter((row) => !seen.has(row.id));
  items.push(...(await ownItems(db, me, fresh.map(mapPost))));
  const allowed = await Promise.all(
    items.map((item) => canViewPost(db, userId, { id: item.postId, authorId: item.author.id, hidden: 0 })),
  );
  return items
    .filter((_, index) => allowed[index])
    .sort((a, b) => b.sharedAt.localeCompare(a.sharedAt) || b.postId - a.postId);
}

async function ownItems(db: Db, me: User, posts: Post[]): Promise<TimelineItem[]> {
  if (!posts.length) return [];
  const ids = posts.map((post) => post.id);
  const sentRows = (await db.all(
    `SELECT post_id, COUNT(DISTINCT to_user_id) AS c FROM shares
     WHERE post_id = ANY(?::int[]) AND from_user_id = ? AND to_user_id <> from_user_id
     GROUP BY post_id`,
    [ids, me.id],
  )) as { post_id: number; c: number }[];
  const sent = new Map(sentRows.map((row) => [row.post_id, row.c]));
  const counts = await engagementMany(db, ids, me.id);
  return posts.map((post) => {
    const sentTo = sent.get(post.id) ?? 0;
    return {
      shareId: -post.id,
      postId: post.id,
      toUserId: me.id,
      kind: post.kind,
      body: post.body,
      author: me,
      sharedBy: me,
      shareKind: "own",
      groupName: null,
      note: null,
      sharedAt: post.createdAt,
      headline: "You posted this.",
      provenance: sentTo
        ? `You sent this to ${sentTo} ${sentTo === 1 ? "person" : "people"}.`
        : "Only you can see this until you share it.",
      chain: [me],
      allowReshare: post.allowReshare,
      frames: post.frames,
      ownPost: true,
      ...counts.get(post.id)!,
    };
  });
}

export async function coreRuleViolations(db: Db) {
  const violations: string[] = [];
  for (const user of await listUsers(db)) {
    const timeline = await getTimeline(db, user.id);
    for (const item of timeline) {
      if (item.toUserId !== user.id) {
        violations.push(`${user.username} timeline item ${item.shareId} is not addressed to them`);
      }
      const share = (await db.get("SELECT to_user_id FROM shares WHERE id = ?", [item.shareId])) as
        | { to_user_id: number }
        | undefined;
      if (!share || share.to_user_id !== user.id) {
        violations.push(`post ${item.postId} is on ${user.username}'s timeline without a share to them`);
      }
    }
  }
  return violations;
}

export async function getMyPosts(db: Db, userId: number) {
  const rows = (await db.all("SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC, id DESC", [userId])) as PostRow[];
  const deliveries = (await db.all(
    `SELECT s.id, s.post_id, s.to_user_id, s.from_user_id, s.share_kind, s.created_at, s.note, u.display_name, u.username
     FROM shares s JOIN posts p ON p.id = s.post_id JOIN profiles u ON u.id = s.to_user_id
     WHERE p.author_id = ?
     ORDER BY s.created_at ASC, s.id ASC`,
    [userId],
  )) as {
    id: number;
    post_id: number;
    to_user_id: number;
    from_user_id: number;
    share_kind: string;
    created_at: string;
    note: string | null;
    display_name: string;
    username: string;
  }[];
  return rows.map((row) => {
    const post = mapPost(row);
    const mine = deliveries.filter((item) => item.post_id === post.id);
    const reshares = mine.filter((item) => item.from_user_id !== userId);
    const onOwnTimeline = mine.some((item) => item.to_user_id === userId);
    return { post, deliveries: mine, reshares, onOwnTimeline };
  });
}

async function membersOf(db: Db, table: "friend_group_members" | "friend_list_members", key: "group_id" | "list_id", ids: number[]) {
  if (!ids.length) return new Map<number, User[]>();
  const rows = (await db.all(
    `SELECT m.${key} AS owner_key, u.* FROM ${table} m JOIN profiles u ON u.id = m.user_id
     WHERE m.${key} = ANY(?::int[]) ORDER BY u.display_name`,
    [ids],
  )) as (UserRow & { owner_key: number })[];
  const map = new Map<number, User[]>();
  for (const row of rows) {
    const list = map.get(row.owner_key) ?? [];
    list.push(mapUser(row));
    map.set(row.owner_key, list);
  }
  return map;
}

export async function listGroups(db: Db, ownerId: number) {
  const groups = (await db.all(
    "SELECT id, name, allows_inbound_share, created_at FROM friend_groups WHERE owner_id = ? ORDER BY name",
    [ownerId],
  )) as { id: number; name: string; allows_inbound_share: number; created_at: string }[];
  const members = await membersOf(
    db,
    "friend_group_members",
    "group_id",
    groups.map((group) => group.id),
  );
  return groups.map((group) => ({ ...group, members: members.get(group.id) ?? [] }));
}

export async function listCustomLists(db: Db, ownerId: number) {
  const lists = (await db.all("SELECT id, name, created_at FROM friend_lists WHERE owner_id = ? ORDER BY name", [ownerId])) as {
    id: number;
    name: string;
    created_at: string;
  }[];
  const members = await membersOf(
    db,
    "friend_list_members",
    "list_id",
    lists.map((list) => list.id),
  );
  return lists.map((list) => ({ ...list, members: members.get(list.id) ?? [] }));
}

export async function pendingIncoming(db: Db, userId: number) {
  const rows = await db.all(`SELECT f.id, u.* FROM friendships f JOIN profiles u ON u.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`, [userId]) as (UserRow & { id: number })[];
  return rows.map((row) => ({ requestId: row.id, user: mapUser(row) }));
}

export async function pendingOutgoing(db: Db, userId: number) {
  const rows = await db.all(`SELECT f.id, u.* FROM friendships f JOIN profiles u ON u.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`, [userId]) as (UserRow & { id: number })[];
  return rows.map((row) => ({ requestId: row.id, user: mapUser(row) }));
}

export async function listAllowIds(db: Db, userId: number) {
  const rows = await db.all("SELECT allowed_id FROM share_allow WHERE user_id = ?", [userId]) as { allowed_id: number }[];
  return new Set(rows.map((row) => row.allowed_id));
}

export async function listBlocks(db: Db, userId: number) {
  const rows = await db.all(`SELECT u.* FROM blocks b JOIN profiles u ON u.id = b.blocked_id
       WHERE b.blocker_id = ? ORDER BY u.display_name`, [userId]) as UserRow[];
  return rows.map(mapUser);
}

export async function requestFriend(db: Db, fromId: number, toUsername: string) {
  const from = await mustUser(db, fromId);
  if (from.suspended) throw new Error("This account is suspended.");
  const to = await getUserByUsername(db, toUsername.trim().toLowerCase());
  if (!to) throw new Error("No one uses that username.");
  if (to.id === fromId) throw new Error("You are already yourself.");
  if (await isBlocked(db, fromId, to.id)) throw new Error("A block stops this request.");
  if (await areFriends(db, fromId, to.id)) throw new Error(`You and ${to.displayName} are already friends.`);
  const existing = await db.get(`SELECT id, status, requester_id FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`, [fromId, to.id, to.id, fromId]) as { id: number; status: string; requester_id: number } | undefined;
  if (existing?.status === "pending") {
    throw new Error("There is already a request between you.");
  }
  if (to.whoCanAdd === "nobody") {
    throw new Error(`${to.displayName} is not accepting friend requests.`);
  }
  if (to.whoCanAdd === "friends_of_friends" && !await sharesAFriend(db, fromId, to.id)) {
    throw new Error(`${to.displayName} only accepts requests from friends of friends.`);
  }
  await db.run(`INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)`, [fromId, to.id, new Date().toISOString()]);
  return to;
}

export async function acceptFriend(db: Db, userId: number, requestId: number) {
  const row = await db.get("SELECT * FROM friendships WHERE id = ?", [requestId]) as
    | { id: number; requester_id: number; addressee_id: number; status: string }
    | undefined;
  if (!row || row.addressee_id !== userId || row.status !== "pending") {
    throw new Error("That request is not waiting on you.");
  }
  await db.run("UPDATE friendships SET status = 'accepted' WHERE id = ?", [requestId]);
}

export async function declineFriend(db: Db, userId: number, requestId: number) {
  const row = await db.get("SELECT * FROM friendships WHERE id = ?", [requestId]) as
    | { addressee_id: number; requester_id: number; status: string }
    | undefined;
  if (!row || row.status !== "pending" || (row.addressee_id !== userId && row.requester_id !== userId)) {
    throw new Error("That request is not yours to close.");
  }
  await db.run("DELETE FROM friendships WHERE id = ?", [requestId]);
}

export async function removeFriend(db: Db, userId: number, otherId: number) {
  await db.run(`DELETE FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`, [userId, otherId, otherId, userId]);
}

export async function blockUser(db: Db, userId: number, otherId: number) {
  if (userId === otherId) throw new Error("You cannot block yourself.");
  await mustUser(db, otherId);
  await db.run("DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)", [userId, otherId, otherId, userId]);
  const now = new Date().toISOString();
  await db.run("INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [userId, otherId, now]);
  await db.run(`DELETE FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`, [userId, otherId, otherId, userId]);
}

export async function unblockUser(db: Db, userId: number, otherId: number) {
  await db.run("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?", [userId, otherId]);
}

export async function createGroup(db: Db, ownerId: number, name: string, memberIds: number[], allowsInbound: boolean) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the group.");
  const groupId = await db.insert(`INSERT INTO friend_groups (owner_id, name, allows_inbound_share, created_at) VALUES (?, ?, ?, ?)`, [ownerId, trimmed.slice(0, 60), allowsInbound ? 1 : 0, new Date().toISOString()]);
  for (const memberId of memberIds) {
    if (!await areFriends(db, ownerId, memberId)) continue;
    await db.run("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [groupId, memberId]);
  }
  return groupId;
}

export async function deleteGroup(db: Db, ownerId: number, groupId: number) {
  await db.run("DELETE FROM friend_groups WHERE id = ? AND owner_id = ?", [groupId, ownerId]);
}

export async function createList(db: Db, ownerId: number, name: string, memberIds: number[]) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the list.");
  const listId = await db.insert("INSERT INTO friend_lists (owner_id, name, created_at) VALUES (?, ?, ?)", [ownerId, trimmed.slice(0, 60), new Date().toISOString()]);
  for (const memberId of memberIds) {
    if (!await areFriends(db, ownerId, memberId)) continue;
    await db.run("INSERT INTO friend_list_members (list_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [listId, memberId]);
  }
  return listId;
}

export async function deleteList(db: Db, ownerId: number, listId: number) {
  await db.run("DELETE FROM friend_lists WHERE id = ? AND owner_id = ?", [listId, ownerId]);
}

export async function updateProfile(db: Db,
  userId: number,
  input: { displayName: string; bio: string; avatarColor: string; location?: string; work?: string; education?: string },
) {
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Use a name people will recognize.");
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  await db.run("UPDATE profiles SET display_name = ?, bio = ?, avatar_color = ?, initials = ? WHERE id = ?", [displayName.slice(0, 80),
    input.bio.trim().slice(0, 280),
    input.avatarColor,
    initials || "•",
    userId]);
  if (input.location !== undefined || input.work !== undefined || input.education !== undefined) {
    await db.run("UPDATE profiles SET location = ?, work = ?, education = ? WHERE id = ?", [(input.location ?? "").trim().slice(0, 80),
      (input.work ?? "").trim().slice(0, 80),
      (input.education ?? "").trim().slice(0, 80),
      userId]);
  }
}

export async function updatePrivacy(db: Db,
  userId: number,
  input: {
    whoCanShare: SharePolicy;
    whoCanAdd: AddPolicy;
    whoCanReshare: ResharePolicy;
    allowListIds: number[];
    inboundGroupIds: number[];
  },
) {
  await db.run("UPDATE profiles SET who_can_share = ?, who_can_add = ?, who_can_reshare = ? WHERE id = ?", [input.whoCanShare,
    input.whoCanAdd,
    input.whoCanReshare,
    userId]);
  await db.run("DELETE FROM share_allow WHERE user_id = ?", [userId]);
  for (const id of input.allowListIds) {
    if (await areFriends(db, userId, id)) {
      await db.run("INSERT INTO share_allow (user_id, allowed_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [userId, id]);
    }
  }
  await db.run("UPDATE friend_groups SET allows_inbound_share = 0 WHERE owner_id = ?", [userId]);
  for (const groupId of input.inboundGroupIds) {
    await db.run("UPDATE friend_groups SET allows_inbound_share = 1 WHERE id = ? AND owner_id = ?", [groupId, userId]);
  }
}

const BLOCKED_EITHER_WAY = (column: string) =>
  `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = ${column}) OR (b.blocker_id = ${column} AND b.blocked_id = ?))`;

/**
 * Reaction, share and comment counts for many posts in four queries.
 * Callers must have run the access check on every id first.
 */
async function engagementMany(db: Db, postIds: number[], viewerId: number): Promise<Map<number, Engagement>> {
  const ids = [...new Set(postIds)];
  const result = new Map<number, Engagement>();
  for (const id of ids) {
    result.set(id, {
      likeCount: 0,
      shareCount: 0,
      liked: false,
      commentCount: 0,
      reactions: { total: 0, mine: null, top: [], counts: {} },
    });
  }
  if (!ids.length) return result;
  const [reactionRows, mineRows, shareRows, commentRows] = await Promise.all([
    db.all(
      `SELECT r.post_id, r.kind, COUNT(*) AS c FROM reactions r
       WHERE r.post_id = ANY(?::int[]) AND ${BLOCKED_EITHER_WAY("r.user_id")}
       GROUP BY r.post_id, r.kind ORDER BY c DESC, r.kind`,
      [ids, viewerId, viewerId],
    ) as Promise<{ post_id: number; kind: ReactionKind; c: number }[]>,
    db.all("SELECT post_id, kind FROM reactions WHERE post_id = ANY(?::int[]) AND user_id = ?", [ids, viewerId]) as Promise<
      { post_id: number; kind: ReactionKind }[]
    >,
    db.all("SELECT post_id, COUNT(*) AS c FROM shares WHERE post_id = ANY(?::int[]) GROUP BY post_id", [ids]) as Promise<
      { post_id: number; c: number }[]
    >,
    db.all(
      `SELECT c.post_id, COUNT(*) AS c FROM comments c
       WHERE c.post_id = ANY(?::int[]) AND ${BLOCKED_EITHER_WAY("c.author_id")}
       GROUP BY c.post_id`,
      [ids, viewerId, viewerId],
    ) as Promise<{ post_id: number; c: number }[]>,
  ]);
  for (const row of reactionRows) {
    const item = result.get(row.post_id)!;
    item.reactions.counts[row.kind] = row.c;
    item.reactions.total += row.c;
    if (item.reactions.top.length < 3) item.reactions.top.push(row.kind);
    item.likeCount = item.reactions.total;
  }
  for (const row of mineRows) {
    const item = result.get(row.post_id)!;
    item.reactions.mine = row.kind;
    item.liked = true;
  }
  for (const row of shareRows) result.get(row.post_id)!.shareCount = row.c;
  for (const row of commentRows) result.get(row.post_id)!.commentCount = row.c;
  return result;
}

async function engagement(db: Db, postId: number, viewerId: number): Promise<Engagement> {
  return (await engagementMany(db, [postId], viewerId)).get(postId)!;
}

/** Counts for a post, or null when the viewer cannot see it. */
export async function postEngagement(db: Db, viewerId: number, postId: number) {
  if (!(await canViewPost(db, viewerId, postId))) return null;
  return engagement(db, postId, viewerId);
}

/** One reaction per person per post. Passing null clears it. Only people who can see the post can react. */
export async function setReaction(db: Db, userId: number, postId: number, kind: ReactionKind | null) {
  if (!(await canViewPost(db, userId, postId))) throw new Error("That post isn’t available to you.");
  if (kind !== null && !REACTION_KINDS.includes(kind)) throw new Error("Pick a reaction.");
  await db.tx(async (db) => {
    await db.run("DELETE FROM reactions WHERE user_id = ? AND post_id = ?", [userId, postId]);
    if (kind) {
      await db.run("INSERT INTO reactions (user_id, post_id, kind, created_at) VALUES (?, ?, ?, ?)", [
        userId,
        postId,
        kind,
        new Date().toISOString(),
      ]);
    }
  });
  return engagement(db, postId, userId);
}

export async function toggleLike(db: Db, userId: number, postId: number) {
  const current = (await engagement(db, postId, userId)).reactions.mine;
  return setReaction(db, userId, postId, current ? null : "like");
}

export type CommentNode = {
  id: number;
  postId: number;
  body: string;
  createdAt: string;
  author: User;
  replies: CommentNode[];
};

/** Comments on a post, oldest first, replies nested one level. Null when the viewer cannot see the post. */
export async function listComments(
  db: Db,
  viewerId: number,
  postId: number,
  options: { allowStaff?: boolean } = {},
): Promise<CommentNode[] | null> {
  if (!(await canViewPost(db, viewerId, postId, options))) return null;
  const rows = (await db.all(
    `SELECT c.* FROM comments c
     WHERE c.post_id = ? AND ${BLOCKED_EITHER_WAY("c.author_id")}
     ORDER BY c.created_at ASC, c.id ASC`,
    [postId, viewerId, viewerId],
  )) as { id: number; post_id: number; author_id: number; parent_id: number | null; body: string; created_at: string }[];
  const authors = await usersByIds(
    db,
    rows.map((row) => row.author_id),
  );
  const nodes = new Map<number, CommentNode>();
  const top: CommentNode[] = [];
  rows.forEach((row, index) => {
    const node: CommentNode = {
      id: row.id,
      postId: row.post_id,
      body: row.body,
      createdAt: row.created_at,
      author: authors[index],
      replies: [],
    };
    nodes.set(row.id, node);
    const parent = row.parent_id ? nodes.get(row.parent_id) : undefined;
    if (parent) parent.replies.push(node);
    else if (!row.parent_id) top.push(node);
  });
  return top;
}

export async function addComment(
  db: Db,
  userId: number,
  postId: number,
  input: { body: string; parentId?: number | null; createdAt?: string },
) {
  const user = await mustUser(db, userId);
  if (user.suspended || user.restricted) throw new Error("Your account cannot comment right now.");
  if (!(await canViewPost(db, userId, postId))) throw new Error("That post isn’t available to you.");
  const body = input.body.trim();
  if (!body) throw new Error("Write a comment first.");
  if (body.length > 1000) throw new Error("Keep comments under 1,000 characters.");
  let parentId: number | null = null;
  let parentAuthor: number | null = null;
  if (input.parentId) {
    const parent = (await db.get("SELECT id, post_id, parent_id, author_id FROM comments WHERE id = ?", [input.parentId])) as
      | { id: number; post_id: number; parent_id: number | null; author_id: number }
      | undefined;
    if (!parent || parent.post_id !== postId) throw new Error("That comment isn’t on this post.");
    parentId = parent.parent_id ?? parent.id;
    parentAuthor = parent.author_id;
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  const post = (await getPost(db, postId))!;
  return db.tx(async (db) => {
    const id = await db.insert("INSERT INTO comments (post_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?)", [
      postId,
      userId,
      parentId,
      body,
      createdAt,
    ]);
    const notify = (to: number, kind: string) =>
      db.run(
        "INSERT INTO notifications (user_id, actor_id, kind, post_id, share_id, read, created_at) VALUES (?, ?, ?, ?, NULL, 0, ?)",
        [to, userId, kind, postId, createdAt],
      );
    if (parentAuthor && parentAuthor !== userId) await notify(parentAuthor, "replied");
    if (post.authorId !== userId && post.authorId !== parentAuthor) await notify(post.authorId, "commented");
    return id;
  });
}

export type ProfileSection = "posts" | "photos" | "videos" | "reels";

const SECTION_KINDS: Record<Exclude<ProfileSection, "posts">, PostKind[]> = {
  photos: ["photo"],
  videos: ["video", "long_video"],
  reels: ["reel", "short"],
};

export type ProfilePost = Engagement & {
  post: Post;
  /** The latest person who sent it to the viewer. Null on your own profile. */
  reachedBy: User | null;
};

/**
 * A person's posts as the viewer is allowed to see them.
 * Your own profile shows everything you made. Anyone else's shows only what reached you.
 */
export async function profilePosts(
  db: Db,
  viewerId: number,
  personId: number,
  section: ProfileSection = "posts",
): Promise<ProfilePost[]> {
  if (!(await canViewProfile(db, viewerId, personId))) return [];
  const kinds = section === "posts" ? null : SECTION_KINDS[section];
  const rows = (await db.all("SELECT * FROM posts WHERE author_id = ? AND hidden = 0 ORDER BY created_at DESC, id DESC", [
    personId,
  ])) as PostRow[];
  const candidates = rows.filter((row) => !kinds || kinds.includes(row.kind as PostKind));
  const allowed = await Promise.all(
    candidates.map((row) => canViewPost(db, viewerId, { id: row.id, authorId: row.author_id, hidden: row.hidden })),
  );
  const visible = candidates.filter((_, index) => allowed[index]);
  const counts = await engagementMany(
    db,
    visible.map((row) => row.id),
    viewerId,
  );
  return Promise.all(
    visible.map(async (row) => {
      let reachedBy: User | null = null;
      if (viewerId !== personId) {
        const share = (await db.get(
          "SELECT from_user_id FROM shares WHERE post_id = ? AND to_user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
          [row.id, viewerId],
        )) as { from_user_id: number } | undefined;
        reachedBy = share ? await mustUser(db, share.from_user_id) : null;
      }
      return { post: mapPost(row), reachedBy, ...counts.get(row.id)! };
    }),
  );
}

/** Kept for older callers. Same rule as profilePosts. */
export async function postsVisibleTo(db: Db, viewerId: number, personId: number) {
  return profilePosts(db, viewerId, personId);
}

export async function mutualFriends(db: Db, a: number, b: number) {
  if (a === b) return [];
  const [mine, theirs] = await Promise.all([friendIds(db, a), friendIds(db, b)]);
  const set = new Set(mine);
  return (await usersByIds(
    db,
    theirs.filter((id) => set.has(id)),
  )).sort((x, y) => x.displayName.localeCompare(y.displayName));
}

export async function profileStats(db: Db, viewerId: number, personId: number) {
  const [friendList, posts, totalRow, sharesRow, mutual] = await Promise.all([
    friendIds(db, personId),
    profilePosts(db, viewerId, personId),
    db.get("SELECT COUNT(*) AS c FROM posts WHERE author_id = ? AND hidden = 0", [personId]) as Promise<{ c: number }>,
    viewerId === personId
      ? (db.get("SELECT COUNT(*) AS c FROM shares WHERE from_user_id = ?", [personId]) as Promise<{ c: number }>)
      : (db.get("SELECT COUNT(*) AS c FROM shares WHERE from_user_id = ? AND to_user_id = ?", [personId, viewerId]) as Promise<{
          c: number;
        }>),
    mutualFriends(db, viewerId, personId),
  ]);
  return {
    friends: friendList.length,
    posts: posts.length,
    shares: sharesRow.c,
    mutual: mutual.length,
    unseen: Math.max(0, totalRow.c - posts.length),
  };
}

export type ReelItem = Engagement & {
  post: Post;
  author: User;
  reachedBy: User | null;
  note: string | null;
  at: string;
};

async function reelItems(db: Db, viewerId: number, rows: PostRow[]): Promise<ReelItem[]> {
  const counts = await engagementMany(
    db,
    rows.map((row) => row.id),
    viewerId,
  );
  return Promise.all(
    rows.map(async (row) => {
      const share = (await db.get(
        "SELECT from_user_id, note, created_at FROM shares WHERE post_id = ? AND to_user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [row.id, viewerId],
      )) as { from_user_id: number; note: string | null; created_at: string } | undefined;
      const author = await mustUser(db, row.author_id);
      const reachedBy = share && share.from_user_id !== viewerId ? await mustUser(db, share.from_user_id) : null;
      return {
        post: mapPost(row),
        author,
        reachedBy,
        note: share?.note ?? null,
        at: share?.created_at ?? row.created_at,
        ...counts.get(row.id)!,
      };
    }),
  );
}

/** Reels that reached the viewer, plus their own. Never a discovery feed. */
export async function listReels(db: Db, viewerId: number): Promise<ReelItem[]> {
  // Only reels the viewer made or that were addressed to them are even loaded; the gate still checks each one.
  const rows = (await db.all(
    `SELECT p.* FROM posts p
     WHERE p.kind IN ('reel', 'short') AND p.hidden = 0
       AND (p.author_id = ? OR EXISTS (SELECT 1 FROM shares s WHERE s.post_id = p.id AND s.to_user_id = ?)
            OR EXISTS (SELECT 1 FROM follower_shares fs JOIN follows f ON f.followee_id = fs.from_user_id
                       WHERE fs.post_id = p.id AND f.follower_id = ?))
     ORDER BY p.created_at DESC, p.id DESC`,
    [viewerId, viewerId, viewerId],
  )) as PostRow[];
  const allowed = await Promise.all(
    rows.map((row) => canViewPost(db, viewerId, { id: row.id, authorId: row.author_id, hidden: row.hidden })),
  );
  const items = await reelItems(
    db,
    viewerId,
    rows.filter((_, index) => allowed[index]),
  );
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** One reel by id. Null when it is not a reel or the viewer cannot see it. */
export async function getReel(db: Db, viewerId: number, postId: number) {
  const row = (await db.get("SELECT * FROM posts WHERE id = ? AND kind IN ('reel', 'short')", [postId])) as PostRow | undefined;
  if (!row) return null;
  if (!(await canViewPost(db, viewerId, { id: row.id, authorId: row.author_id, hidden: row.hidden }))) return null;
  return (await reelItems(db, viewerId, [row]))[0];
}

export type Relationship = "self" | "blocked" | "blocked_by" | "friends" | "none" | "outgoing" | "incoming";
export type PersonCard = { user: User; mutual: User[]; relationship: Relationship };

/** People you may know, by mutual friends only. Never based on content. */
export async function friendSuggestions(db: Db, userId: number, limit = 8): Promise<PersonCard[]> {
  const mine = new Set(await friendIds(db, userId));
  const candidates = new Set<number>();
  for (const ids of await Promise.all([...mine].map((friend) => friendIds(db, friend)))) {
    for (const id of ids) candidates.add(id);
  }
  const cards = await Promise.all(
    [...candidates]
      .filter((id) => id !== userId && !mine.has(id))
      .map(async (id): Promise<PersonCard | null> => {
        const rel = await relationship(db, userId, id);
        if (rel !== "none") return null;
        const user = await mustUser(db, id);
        if (user.suspended || user.whoCanAdd === "nobody") return null;
        return { user, mutual: await mutualFriends(db, userId, id), relationship: rel };
      }),
  );
  return cards
    .filter((card): card is PersonCard => card !== null)
    .sort((a, b) => b.mutual.length - a.mutual.length || a.user.displayName.localeCompare(b.user.displayName))
    .slice(0, limit);
}

/** Find people by name or username. Returns people only, never posts. */
export async function searchPeople(db: Db, viewerId: number, query: string, limit = 20): Promise<PersonCard[]> {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (q.length < 1) return [];
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  const rows = (await db.all(
    `SELECT * FROM profiles
     WHERE (lower(display_name) LIKE ? OR lower(username) LIKE ?)
       AND id <> ?
       AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = profiles.id AND blocked_id = ?)
     ORDER BY display_name LIMIT ?`,
    [like, like, viewerId, viewerId, limit],
  )) as UserRow[];
  return Promise.all(
    rows.map(async (row) => {
      const user = mapUser(row);
      const [mutual, rel] = await Promise.all([mutualFriends(db, viewerId, user.id), relationship(db, viewerId, user.id)]);
      return { user, mutual, relationship: rel };
    }),
  );
}

export async function setAllowReshare(db: Db, userId: number, postId: number, allow: boolean) {
  const post = await getPost(db, postId);
  if (!post || post.authorId !== userId) throw new Error("Only the creator can change resharing.");
  await db.run("UPDATE posts SET allow_reshare = ? WHERE id = ?", [allow ? 1 : 0, postId]);
}

export async function relationship(db: Db, viewerId: number, otherId: number): Promise<Relationship> {
  if (viewerId === otherId) return "self" as const;
  if (await isBlocked(db, viewerId, otherId)) {
    const iBlocked = await db.get("SELECT 1 AS ok FROM blocks WHERE blocker_id = ? AND blocked_id = ?", [viewerId, otherId]);
    return iBlocked ? ("blocked" as const) : ("blocked_by" as const);
  }
  if (await areFriends(db, viewerId, otherId)) return "friends" as const;
  const pending = await db.get(`SELECT requester_id FROM friendships
       WHERE status = 'pending'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`, [viewerId, otherId, otherId, viewerId]) as { requester_id: number } | undefined;
  if (!pending) return "none" as const;
  return pending.requester_id === viewerId ? ("outgoing" as const) : ("incoming" as const);
}

export async function listNotifications(db: Db, userId: number) {
  const rows = await db.all(`SELECT n.*, u.display_name AS actor_name, u.username AS actor_username, u.initials AS actor_initials,
              u.avatar_color AS actor_color, p.kind AS post_kind, p.body AS post_body, p.frames AS post_frames
       FROM notifications n
       JOIN profiles u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC`, [userId]) as {
    id: number;
    kind: string;
    actor_id: number;
    actor_name: string;
    actor_username: string;
    actor_initials: string;
    actor_color: string;
    post_id: number | null;
    post_kind: string | null;
    post_body: string | null;
    post_frames: Frame[] | null;
    read: number;
    created_at: string;
  }[];
  return rows.map((row) => {
    let text = `${row.actor_name} shared something with you.`;
    if (row.kind === "shared_onward") text = `${row.actor_name} shared your post onward.`;
    if (row.kind === "reshared_video") text = `${row.actor_name} reshared your video.`;
    if (row.kind === "commented") text = `${row.actor_name} commented on your post.`;
    if (row.kind === "replied") text = `${row.actor_name} replied to your comment.`;
    if (row.kind === "followed_you") text = `${row.actor_name} started following you.`;
    return { ...row, text };
  });
}

export async function unreadCount(db: Db, userId: number) {
  const row = await db.get("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0", [userId]) as { c: number };
  return row.c;
}

export async function markNotificationRead(db: Db, userId: number, notificationId: number) {
  const row = await db.get("SELECT id, post_id FROM notifications WHERE id = ? AND user_id = ?", [notificationId, userId]) as { id: number; post_id: number | null } | undefined;
  if (!row) return null;
  await db.run("UPDATE notifications SET read = 1 WHERE id = ?", [notificationId]);
  return row.post_id;
}

export async function markAllNotificationsRead(db: Db, userId: number) {
  await db.run("UPDATE notifications SET read = 1 WHERE user_id = ?", [userId]);
}

export async function shareHistory(db: Db, postId: number) {
  return await db.all(`SELECT s.id, s.created_at, s.note, s.share_kind, s.to_user_id, s.from_user_id,
              fu.display_name AS from_name, tu.display_name AS to_name, g.name AS group_name
       FROM shares s
       JOIN profiles fu ON fu.id = s.from_user_id
       JOIN profiles tu ON tu.id = s.to_user_id
       LEFT JOIN friend_groups g ON g.id = s.group_id
       WHERE s.post_id = ?
       ORDER BY s.created_at ASC, s.id ASC`, [postId]) as {
    id: number;
    created_at: string;
    note: string | null;
    share_kind: string;
    to_user_id: number;
    from_user_id: number;
    from_name: string;
    to_name: string;
    group_name: string | null;
  }[];
}

export async function sentActivity(db: Db, userId: number) {
  return await db.all(`SELECT s.created_at, s.to_user_id, tu.display_name AS to_name, p.kind, p.id AS post_id
       FROM shares s
       JOIN profiles tu ON tu.id = s.to_user_id
       JOIN posts p ON p.id = s.post_id
       WHERE s.from_user_id = ?
       ORDER BY s.created_at DESC LIMIT 8`, [userId]) as {
    created_at: string;
    to_user_id: number;
    to_name: string;
    kind: string;
    post_id: number;
  }[];
}

export async function createTicket(db: Db, userId: number, subject: string, body: string) {
  const title = subject.trim();
  const text = body.trim();
  if (title.length < 3) throw new Error("Add a subject.");
  if (text.length < 3) throw new Error("Say a little more so support can help.");
  await db.run("INSERT INTO tickets (user_id, subject, body, status, created_at) VALUES (?, ?, ?, 'open', ?)", [userId,
    title.slice(0, 120),
    text.slice(0, 2000),
    new Date().toISOString()]);
}

export type ShareTarget = {
  id: number;
  username: string;
  displayName: string;
  initials: string;
  avatarColor: string;
  avatarUrl: string | null;
  ok: boolean;
  reason: string | null;
  alreadySent: boolean;
};

/**
 * Who the signed-in person may pick in the share sheet, with the gate result for each friend.
 * The gate is checked again when the share is written, so this is advice for the picker only.
 */
export async function shareTargets(db: Db, viewer: User, post: Post) {
  const sentRows = (await db.all("SELECT to_user_id FROM shares WHERE post_id = ? AND from_user_id = ?", [post.id, viewer.id])) as {
    to_user_id: number;
  }[];
  const sent = new Set(sentRows.map((row) => row.to_user_id));
  const friendList = await listFriends(db, viewer.id);
  const friends: ShareTarget[] = await Promise.all(
    friendList.map(async (friend) => {
      const decision = await canShareWith(db, viewer.id, friend.id, post);
      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        initials: friend.initials,
        avatarColor: friend.avatarColor,
        avatarUrl: friend.avatarUrl,
        ok: decision.ok && !sent.has(friend.id),
        reason: sent.has(friend.id) ? "Already sent" : decision.ok ? null : decision.reason,
        alreadySent: sent.has(friend.id),
      };
    }),
  );
  friends.sort((a, b) => Number(b.ok) - Number(a.ok) || a.displayName.localeCompare(b.displayName));
  const [self, groups, lists] = await Promise.all([
    canShareWith(db, viewer.id, viewer.id, post),
    listGroups(db, viewer.id),
    listCustomLists(db, viewer.id),
  ]);
  const pack = (members: User[]) =>
    members.map((member) => ({ id: member.id, displayName: member.displayName, initials: member.initials, avatarColor: member.avatarColor }));
  return {
    friends,
    groups: groups.map((group) => ({ id: group.id, name: group.name, members: pack(group.members) })),
    lists: lists.map((list) => ({ id: list.id, name: list.name, members: pack(list.members) })),
    self: { ok: self.ok && !sent.has(viewer.id), reason: sent.has(viewer.id) ? "Already in your feed" : self.ok ? null : self.reason },
    // The Followers audience exists only for the post's author.
    followers:
      post.authorId === viewer.id
        ? { available: true, alreadySent: await sentToFollowers(db, post.id), count: (await followCounts(db, viewer.id)).followers }
        : { available: false, alreadySent: false, count: 0 },
  };
}

/** Friends to show in the desktop rail: people you can pass things to, and how often you have. Not a feed. */
export async function shareCircle(db: Db, userId: number) {
  const friends = await listFriends(db, userId);
  const rows = (await db.all(
    `SELECT from_user_id, to_user_id, COUNT(*) AS c FROM shares
     WHERE (from_user_id = ? OR to_user_id = ?) AND from_user_id <> to_user_id
     GROUP BY from_user_id, to_user_id`,
    [userId, userId],
  )) as { from_user_id: number; to_user_id: number; c: number }[];
  return friends
    .map((friend) => {
      const sentTo = rows.find((row) => row.from_user_id === userId && row.to_user_id === friend.id)?.c ?? 0;
      const got = rows.find((row) => row.from_user_id === friend.id && row.to_user_id === userId)?.c ?? 0;
      return { user: friend, sentTo, got, open: friend.whoCanShare !== "nobody" && !friend.suspended };
    })
    .sort((a, b) => b.sentTo + b.got - (a.sentTo + a.got) || a.user.displayName.localeCompare(b.user.displayName));
}

export const AVATAR_COLORS = ["#00bf8f", "#24527a", "#e05a33", "#8a5a2b", "#6b3a55", "#7b2cbf", "#c44b7a", "#2f2f2f"];

// ── Followers audience, follows, Discover, delete, profile photos ─────────────────────────────

/**
 * Send a post to everyone who follows its author, including future followers.
 * Only the original author may do this; a resharer can never send someone else's post to their followers.
 */
export async function shareToFollowers(db: Db, postId: number, fromUserId: number, note?: string | null) {
  const post = await getPost(db, postId);
  if (!post) throw new Error("That post is gone.");
  if (post.authorId !== fromUserId) throw new Error("Only the person who made a post can send it to their followers.");
  if (post.hidden) throw new Error("Moderation removed this, so it cannot be shared.");
  const me = await mustUser(db, fromUserId);
  if (me.suspended || me.restricted) throw new Error("Your account cannot share right now.");
  if ((await getSetting(db, "sharing_paused")) === "1") throw new Error("Sharing is paused.");
  const clean = note?.trim() ? note.trim().slice(0, 200) : null;
  const existing = await db.get("SELECT 1 AS ok FROM follower_shares WHERE post_id = ? AND from_user_id = ?", [postId, fromUserId]);
  await db.run(
    "INSERT INTO follower_shares (post_id, from_user_id, note, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    [postId, fromUserId, clean, new Date().toISOString()],
  );
  return { alreadySent: Boolean(existing) };
}

export async function sentToFollowers(db: Db, postId: number) {
  return Boolean(await db.get("SELECT 1 AS ok FROM follower_shares WHERE post_id = ? AND from_user_id = (SELECT author_id FROM posts WHERE id = ?)", [postId, postId]));
}

export async function isFollowing(db: Db, followerId: number, followeeId: number) {
  return Boolean(await db.get("SELECT 1 AS ok FROM follows WHERE follower_id = ? AND followee_id = ?", [followerId, followeeId]));
}

export async function follow(db: Db, followerId: number, followeeId: number) {
  if (followerId === followeeId) throw new Error("You can’t follow yourself.");
  const other = await mustUser(db, followeeId);
  if (await isBlocked(db, followerId, followeeId)) throw new Error(`You can’t follow ${other.displayName}.`);
  const fresh = !(await isFollowing(db, followerId, followeeId));
  await db.run("INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [
    followerId,
    followeeId,
    new Date().toISOString(),
  ]);
  if (fresh) {
    await db.run("INSERT INTO notifications (user_id, kind, actor_id, read, created_at) VALUES (?, 'followed_you', ?, 0, ?)", [
      followeeId,
      followerId,
      new Date().toISOString(),
    ]);
  }
}

export async function unfollow(db: Db, followerId: number, followeeId: number) {
  await db.run("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", [followerId, followeeId]);
}

export async function followCounts(db: Db, personId: number) {
  const row = (await db.get(
    `SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?)::int AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?)::int AS following`,
    [personId, personId],
  )) as { followers: number; following: number };
  return { followers: Number(row.followers), following: Number(row.following) };
}

/** Followers or following of a person, hiding anyone across a block from the viewer. */
export async function listFollows(db: Db, viewerId: number, personId: number, which: "followers" | "following") {
  const [mine, other] = which === "followers" ? ["followee_id", "follower_id"] : ["follower_id", "followee_id"];
  const rows = (await db.all(
    `SELECT p.* FROM follows f JOIN profiles p ON p.id = f.${other}
     WHERE f.${mine} = ?
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = ?))
     ORDER BY f.created_at DESC`,
    [personId, viewerId, viewerId],
  )) as UserRow[];
  return rows.map(mapUser);
}

export type DiscoverItem = Engagement & { post: Post; author: User; note: string | null; at: string };

/**
 * Discover: only posts that people you follow sent to Followers, newest first.
 * No ranking, no strangers, no friends-only posts. Each item still passes the access gate.
 */
export async function getDiscover(db: Db, viewerId: number): Promise<DiscoverItem[]> {
  const rows = (await db.all(
    `SELECT p.*, fs.note AS fs_note, fs.created_at AS fs_at
     FROM follower_shares fs
     JOIN follows f ON f.followee_id = fs.from_user_id AND f.follower_id = ?
     JOIN posts p ON p.id = fs.post_id AND p.author_id = fs.from_user_id
     WHERE p.hidden = 0
     ORDER BY fs.created_at DESC, p.id DESC
     LIMIT 100`,
    [viewerId],
  )) as (PostRow & { fs_note: string | null; fs_at: string })[];
  const allowed = await Promise.all(
    rows.map((row) => canViewPost(db, viewerId, { id: row.id, authorId: row.author_id, hidden: row.hidden })),
  );
  const visible = rows.filter((_, i) => allowed[i]);
  const counts = await engagementMany(db, visible.map((row) => row.id), viewerId);
  return Promise.all(
    visible.map(async (row) => ({
      post: mapPost(row),
      author: await mustUser(db, row.author_id),
      note: row.fs_note,
      at: row.fs_at,
      ...counts.get(row.id)!,
    })),
  );
}

/**
 * The author deletes their own post. Shares, follower sends, comments, reactions and notifications
 * go with it (foreign keys cascade). Returns the storage paths so the caller removes the files.
 */
export async function deletePost(db: Db, userId: number, postId: number) {
  const post = await getPost(db, postId);
  if (!post || post.authorId !== userId) throw new Error("Only the person who made a post can delete it.");
  await db.run("DELETE FROM posts WHERE id = ? AND author_id = ?", [postId, userId]);
  return post.frames.map((frame) => frame.path);
}

export async function setProfileImage(db: Db, userId: number, which: "avatar" | "cover", path: string | null) {
  const column = which === "avatar" ? "avatar_path" : "cover_path";
  const before = (await db.get(`SELECT ${column} AS path FROM profiles WHERE id = ?`, [userId])) as { path: string | null } | undefined;
  await db.run(`UPDATE profiles SET ${column} = ? WHERE id = ?`, [path, userId]);
  return before?.path ?? null;
}
