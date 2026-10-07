import type Database from "better-sqlite3";
import { isVideoKind } from "./format";
import type { AddPolicy, Post, PostKind, PostRow, ResharePolicy, SharePolicy, User, UserRow } from "./types";
import { mapPost, mapUser } from "./types";

export type TimelineItem = {
  shareId: number;
  postId: number;
  toUserId: number;
  kind: PostKind;
  body: string;
  mediaLabel: string | null;
  mediaTone: string | null;
  author: User;
  sharedBy: User;
  shareKind: string;
  groupName: string | null;
  note: string | null;
  sharedAt: string;
  headline: string;
  provenance: string;
  allowReshare: number;
  listedOnDiscover: number;
};

export type ShareRejection = { userId: number; name: string; reason: string };
export type ShareSuccess = { userId: number; shareId: number };

const POST_KINDS = new Set(["text", "photo", "video", "short", "long_video", "reel"]);

export function getUserById(db: Database.Database, id: number) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserByUsername(db: Database.Database, username: string) {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function mustUser(db: Database.Database, id: number) {
  const user = getUserById(db, id);
  if (!user) throw new Error("That person is not on LINE.");
  return user;
}

export function listUsers(db: Database.Database) {
  const rows = db.prepare("SELECT * FROM users ORDER BY display_name COLLATE NOCASE").all() as UserRow[];
  return rows.map(mapUser);
}

export function getPost(db: Database.Database, id: number) {
  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow | undefined;
  return row ? mapPost(row) : null;
}

export function getPostBySeedKey(db: Database.Database, seedKey: string) {
  const row = db.prepare("SELECT * FROM posts WHERE seed_key = ?").get(seedKey) as PostRow | undefined;
  return row ? mapPost(row) : null;
}

export function getSetting(db: Database.Database, key: string) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function listPermissions(db: Database.Database, userId: number) {
  const rows = db.prepare("SELECT permission FROM permissions WHERE user_id = ? ORDER BY permission").all(userId) as {
    permission: string;
  }[];
  return rows.map((row) => row.permission);
}

export function hasPermission(db: Database.Database, userId: number, permission: string) {
  const row = db
    .prepare("SELECT 1 AS ok FROM permissions WHERE user_id = ? AND permission = ?")
    .get(userId, permission) as { ok: number } | undefined;
  return Boolean(row);
}

export function areFriends(db: Database.Database, a: number, b: number) {
  if (a === b) return false;
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
    )
    .get(a, b, b, a) as { ok: number } | undefined;
  return Boolean(row);
}

export function isBlocked(db: Database.Database, a: number, b: number) {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM blocks
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    )
    .get(a, b, b, a) as { ok: number } | undefined;
  return Boolean(row);
}

export function friendIds(db: Database.Database, userId: number) {
  const rows = db
    .prepare(
      `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id
       FROM friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`,
    )
    .all(userId, userId, userId) as { id: number }[];
  return rows.map((row) => row.id);
}

export function listFriends(db: Database.Database, userId: number) {
  const ids = friendIds(db, userId);
  return ids
    .map((id) => mustUser(db, id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function sharesAFriend(db: Database.Database, a: number, b: number) {
  const mine = new Set(friendIds(db, a));
  return friendIds(db, b).some((id) => mine.has(id));
}

function inInboundGroup(db: Database.Database, ownerId: number, senderId: number) {
  const row = db
    .prepare(
      `SELECT 1 AS ok
       FROM friend_groups g
       JOIN friend_group_members m ON m.group_id = g.id
       WHERE g.owner_id = ? AND g.allows_inbound_share = 1 AND m.user_id = ?`,
    )
    .get(ownerId, senderId) as { ok: number } | undefined;
  return Boolean(row);
}

function onAllowList(db: Database.Database, ownerId: number, senderId: number) {
  const row = db
    .prepare("SELECT 1 AS ok FROM share_allow WHERE user_id = ? AND allowed_id = ?")
    .get(ownerId, senderId) as { ok: number } | undefined;
  return Boolean(row);
}

export function hasShareTo(db: Database.Database, postId: number, userId: number) {
  const row = db
    .prepare("SELECT 1 AS ok FROM shares WHERE post_id = ? AND to_user_id = ?")
    .get(postId, userId) as { ok: number } | undefined;
  return Boolean(row);
}

export function canShareWith(db: Database.Database, fromId: number, toId: number, post: Post) {
  if (getSetting(db, "sharing_paused") === "1") {
    return { ok: false as const, reason: "Sharing is paused." };
  }
  const from = mustUser(db, fromId);
  const to = mustUser(db, toId);
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
    const author = mustUser(db, post.authorId);
    if (author.whoCanReshare === "nobody") {
      return { ok: false as const, reason: "The creator does not allow resharing." };
    }
    if (author.whoCanReshare === "friends" && !areFriends(db, fromId, author.id)) {
      return { ok: false as const, reason: "Only friends of the creator can reshare this." };
    }
    if (author.whoCanReshare === "recipients") {
      const received = hasShareTo(db, post.id, fromId) || post.listedOnDiscover === 1;
      if (!received) {
        return { ok: false as const, reason: "You can reshare this only after it was shared with you, or from Discover." };
      }
    }
  }
  if (fromId === toId) return { ok: true as const };
  if (to.suspended) {
    return { ok: false as const, reason: `${to.displayName} is not receiving shares.` };
  }
  if (isBlocked(db, fromId, toId)) {
    return { ok: false as const, reason: `A block stops sharing with ${to.displayName}.` };
  }
  if (to.whoCanShare === "nobody") {
    return { ok: false as const, reason: `${to.displayName} is not accepting shares.` };
  }
  if (to.whoCanShare === "friends" && !areFriends(db, fromId, toId)) {
    return { ok: false as const, reason: `${to.displayName} only accepts shares from friends.` };
  }
  if (to.whoCanShare === "allow_list" && !onAllowList(db, toId, fromId)) {
    return { ok: false as const, reason: `${to.displayName} has not allowed shares from you.` };
  }
  if (to.whoCanShare === "groups" && !inInboundGroup(db, toId, fromId)) {
    return { ok: false as const, reason: `${to.displayName} only accepts shares from certain groups.` };
  }
  return { ok: true as const };
}

function parentShareId(db: Database.Database, post: Post, fromId: number) {
  if (post.authorId === fromId) return null;
  const row = db
    .prepare(
      `SELECT id FROM shares
       WHERE post_id = ? AND to_user_id = ? AND from_user_id != ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(post.id, fromId, fromId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function sharePost(
  db: Database.Database,
  input: {
    postId: number;
    fromUserId: number;
    recipients: { userId: number; shareKind: "direct" | "group" | "list" | "self"; groupId?: number | null; listId?: number | null }[];
    note?: string | null;
    createdAt?: string;
  },
) {
  const post = getPost(db, input.postId);
  if (!post) throw new Error("That post is gone.");
  const note = input.note?.trim() ? input.note.trim().slice(0, 200) : null;
  const created: ShareSuccess[] = [];
  const rejected: ShareRejection[] = [];
  const seen = new Set<number>();

  const run = db.transaction(() => {
    for (const recipient of input.recipients) {
      if (seen.has(recipient.userId)) continue;
      seen.add(recipient.userId);
      const person = getUserById(db, recipient.userId);
      if (!person) {
        rejected.push({ userId: recipient.userId, name: "Someone", reason: "No such person." });
        continue;
      }
      const decision = canShareWith(db, input.fromUserId, recipient.userId, post);
      if (!decision.ok) {
        rejected.push({ userId: person.id, name: person.displayName, reason: decision.reason });
        continue;
      }
      const existing = db
        .prepare("SELECT id FROM shares WHERE post_id = ? AND from_user_id = ? AND to_user_id = ?")
        .get(post.id, input.fromUserId, person.id) as { id: number } | undefined;
      if (existing) {
        rejected.push({
          userId: person.id,
          name: person.displayName,
          reason: `You already shared this with ${person.displayName}.`,
        });
        continue;
      }
      const when = input.createdAt ?? new Date().toISOString();
      const info = db
        .prepare(
          `INSERT INTO shares
            (post_id, from_user_id, to_user_id, share_kind, group_id, list_id, parent_share_id, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          post.id,
          input.fromUserId,
          person.id,
          recipient.shareKind,
          recipient.groupId ?? null,
          recipient.listId ?? null,
          parentShareId(db, post, input.fromUserId),
          note,
          when,
        );
      const shareId = Number(info.lastInsertRowid);
      created.push({ userId: person.id, shareId });
      if (person.id !== input.fromUserId) {
        db.prepare(
          `INSERT INTO notifications (user_id, kind, actor_id, post_id, share_id, read, created_at)
           VALUES (?, 'shared_with_you', ?, ?, ?, 0, ?)`,
        ).run(person.id, input.fromUserId, post.id, shareId, when);
      }
      if (input.fromUserId !== post.authorId) {
        const kind = isVideoKind(post.kind) ? "reshared_video" : "shared_onward";
        db.prepare(
          `INSERT INTO notifications (user_id, kind, actor_id, post_id, share_id, read, created_at)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
        ).run(post.authorId, kind, input.fromUserId, post.id, shareId, when);
      }
    }
  });
  run();
  return { created, rejected };
}

export type RecipientChoice = {
  self: boolean;
  friendIds: number[];
  groupIds: number[];
  listIds: number[];
};

export function expandRecipients(db: Database.Database, fromUserId: number, choice: RecipientChoice) {
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
    const group = db
      .prepare("SELECT id, name FROM friend_groups WHERE id = ? AND owner_id = ?")
      .get(groupId, fromUserId) as { id: number; name: string } | undefined;
    if (!group) {
      errors.push("One of those groups is not yours.");
      continue;
    }
    const members = db.prepare("SELECT user_id FROM friend_group_members WHERE group_id = ?").all(groupId) as {
      user_id: number;
    }[];
    if (members.length === 0) errors.push(`${group.name} has no one in it.`);
    for (const member of members) {
      recipients.push({ userId: member.user_id, shareKind: "group", groupId });
    }
  }
  for (const listId of choice.listIds) {
    const list = db
      .prepare("SELECT id, name FROM friend_lists WHERE id = ? AND owner_id = ?")
      .get(listId, fromUserId) as { id: number; name: string } | undefined;
    if (!list) {
      errors.push("One of those lists is not yours.");
      continue;
    }
    const members = db.prepare("SELECT user_id FROM friend_list_members WHERE list_id = ?").all(listId) as {
      user_id: number;
    }[];
    if (members.length === 0) errors.push(`${list.name} has no one in it.`);
    for (const member of members) {
      recipients.push({ userId: member.user_id, shareKind: "list", listId });
    }
  }
  return { recipients, errors };
}

export function createPost(
  db: Database.Database,
  authorId: number,
  input: {
    kind: string;
    body: string;
    mediaLabel?: string | null;
    mediaTone?: string | null;
    listedOnDiscover: boolean;
    allowReshare: boolean;
    seedKey?: string | null;
    createdAt?: string;
  },
) {
  const author = mustUser(db, authorId);
  if (author.suspended || author.restricted) {
    throw new Error("Your account cannot create posts right now.");
  }
  if (!POST_KINDS.has(input.kind)) throw new Error("Choose a kind of post.");
  const body = input.body.trim();
  if (!body) throw new Error("Write something first.");
  if (body.length > 2000) throw new Error("Keep it under 2,000 characters.");
  if (input.kind !== "text" && !input.mediaLabel) {
    throw new Error("Choose a placeholder frame. Real upload is not connected.");
  }
  const info = db
    .prepare(
      `INSERT INTO posts
        (author_id, kind, body, media_label, media_tone, listed_on_discover, allow_reshare, hidden, seed_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(
      authorId,
      input.kind,
      body,
      input.kind === "text" ? null : input.mediaLabel ?? null,
      input.kind === "text" ? null : input.mediaTone ?? "#c4b49a",
      input.listedOnDiscover ? 1 : 0,
      input.allowReshare ? 1 : 0,
      input.seedKey ?? null,
      input.createdAt ?? new Date().toISOString(),
    );
  return Number(info.lastInsertRowid);
}

export function publishPost(
  db: Database.Database,
  authorId: number,
  input: {
    kind: string;
    body: string;
    mediaLabel?: string | null;
    mediaTone?: string | null;
    listedOnDiscover: boolean;
    allowReshare: boolean;
    choice: RecipientChoice;
    note?: string | null;
  },
) {
  const { recipients, errors } = expandRecipients(db, authorId, input.choice);
  if (recipients.length === 0 && !input.listedOnDiscover) {
    throw new Error("Choose your timeline, people, a group, a list, or Discover. A post does not go anywhere on its own.");
  }
  const postId = createPost(db, authorId, input);
  const shared = recipients.length
    ? sharePost(db, { postId, fromUserId: authorId, recipients, note: input.note })
    : { created: [], rejected: [] };
  return { postId, ...shared, errors };
}

function provenance(db: Database.Database, shareId: number, parentId: number | null, author: User, sender: User, viewerId: number) {
  if (sender.id === viewerId && author.id === viewerId) {
    return "Originally created by you.";
  }
  if (sender.id === viewerId) {
    return `Originally created by ${author.displayName}.`;
  }
  if (sender.id === author.id) {
    return `Originally created by ${author.displayName}.`;
  }
  const passed: string[] = [];
  let cursor = parentId;
  const seen = new Set<number>([shareId]);
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = db
      .prepare("SELECT id, from_user_id, parent_share_id FROM shares WHERE id = ?")
      .get(cursor) as { id: number; from_user_id: number; parent_share_id: number | null } | undefined;
    if (!parent) break;
    if (parent.from_user_id !== author.id && parent.from_user_id !== sender.id) {
      passed.push(mustUser(db, parent.from_user_id).displayName);
    }
    cursor = parent.parent_share_id;
  }
  passed.reverse();
  const via = passed.length ? ` Passed along by ${passed.join(", then ")}.` : "";
  return `Originally created by ${author.displayName}. Shared with you by ${sender.displayName}.${via}`;
}

/**
 * Personal timeline. A row exists only because someone addressed a share to this user
 * (including a share they addressed to themselves). Discover is a different query.
 */
export function getTimeline(db: Database.Database, userId: number): TimelineItem[] {
  const rows = db
    .prepare(
      `SELECT
         s.id AS share_id,
         s.post_id,
         s.from_user_id,
         s.to_user_id,
         s.share_kind,
         s.group_id,
         s.parent_share_id,
         s.note,
         s.created_at AS shared_at,
         p.kind,
         p.body,
         p.media_label,
         p.media_tone,
         p.author_id,
         p.allow_reshare,
         p.listed_on_discover,
         g.name AS group_name
       FROM shares s
       JOIN posts p ON p.id = s.post_id
       LEFT JOIN friend_groups g ON g.id = s.group_id
       WHERE s.to_user_id = ?
         AND p.hidden = 0
       ORDER BY s.created_at DESC, s.id DESC`,
    )
    .all(userId) as {
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
    media_label: string | null;
    media_tone: string | null;
    author_id: number;
    allow_reshare: number;
    listed_on_discover: number;
    group_name: string | null;
  }[];

  return rows.map((row) => {
    const author = mustUser(db, row.author_id);
    const sharedBy = mustUser(db, row.from_user_id);
    const self = sharedBy.id === userId;
    let headline = `${sharedBy.displayName} shared this with you.`;
    if (self && author.id === userId && row.share_kind === "self") {
      headline = "You published this to your timeline.";
    } else if (self) {
      headline = "You shared this onto your timeline.";
    }
    return {
      shareId: row.share_id,
      postId: row.post_id,
      toUserId: row.to_user_id,
      kind: row.kind,
      body: row.body,
      mediaLabel: row.media_label,
      mediaTone: row.media_tone,
      author,
      sharedBy,
      shareKind: row.share_kind,
      groupName: row.group_name,
      note: row.note,
      sharedAt: row.shared_at,
      headline,
      provenance: provenance(db, row.share_id, row.parent_share_id, author, sharedBy, userId),
      allowReshare: row.allow_reshare,
      listedOnDiscover: row.listed_on_discover,
    };
  });
}

export function getDiscover(db: Database.Database) {
  if (getSetting(db, "discover_enabled") !== "1") return [];
  const rows = db
    .prepare(
      `SELECT * FROM posts
       WHERE listed_on_discover = 1 AND hidden = 0
       ORDER BY created_at DESC, id DESC`,
    )
    .all() as PostRow[];
  return rows.map((row) => {
    const post = mapPost(row);
    const shareCount = (
      db.prepare("SELECT COUNT(*) AS c FROM shares WHERE post_id = ?").get(post.id) as { c: number }
    ).c;
    return { post, author: mustUser(db, post.authorId), shareCount };
  });
}

export function coreRuleViolations(db: Database.Database) {
  const violations: string[] = [];
  for (const user of listUsers(db)) {
    const timeline = getTimeline(db, user.id);
    for (const item of timeline) {
      if (item.toUserId !== user.id) {
        violations.push(`${user.username} timeline item ${item.shareId} is not addressed to them`);
      }
      const share = db
        .prepare("SELECT to_user_id FROM shares WHERE id = ?")
        .get(item.shareId) as { to_user_id: number } | undefined;
      if (!share || share.to_user_id !== user.id) {
        violations.push(`post ${item.postId} is on ${user.username}'s timeline without a share to them`);
      }
    }
    const timelineIds = new Set(timeline.map((item) => item.postId));
    const discover = db
      .prepare("SELECT id, seed_key FROM posts WHERE listed_on_discover = 1")
      .all() as { id: number; seed_key: string | null }[];
    for (const post of discover) {
      const shared = db
        .prepare("SELECT 1 AS ok FROM shares WHERE post_id = ? AND to_user_id = ?")
        .get(post.id, user.id) as { ok: number } | undefined;
      if (!shared && timelineIds.has(post.id)) {
        violations.push(`Discover item ${post.seed_key ?? post.id} leaked onto ${user.username}'s timeline`);
      }
    }
  }
  return violations;
}

export function getMyPosts(db: Database.Database, userId: number) {
  const rows = db
    .prepare("SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC, id DESC")
    .all(userId) as PostRow[];
  return rows.map((row) => {
    const post = mapPost(row);
    const deliveries = db
      .prepare(
        `SELECT s.id, s.to_user_id, s.from_user_id, s.share_kind, s.created_at, s.note, u.display_name, u.username
         FROM shares s JOIN users u ON u.id = s.to_user_id
         WHERE s.post_id = ?
         ORDER BY s.created_at ASC, s.id ASC`,
      )
      .all(post.id) as {
      id: number;
      to_user_id: number;
      from_user_id: number;
      share_kind: string;
      created_at: string;
      note: string | null;
      display_name: string;
      username: string;
    }[];
    const reshares = deliveries.filter((item) => item.from_user_id !== userId);
    const onOwnTimeline = deliveries.some((item) => item.to_user_id === userId);
    return { post, deliveries, reshares, onOwnTimeline };
  });
}

export function listGroups(db: Database.Database, ownerId: number) {
  const groups = db
    .prepare("SELECT id, name, allows_inbound_share, created_at FROM friend_groups WHERE owner_id = ? ORDER BY name")
    .all(ownerId) as { id: number; name: string; allows_inbound_share: number; created_at: string }[];
  return groups.map((group) => {
    const members = db
      .prepare(
        `SELECT u.* FROM friend_group_members m JOIN users u ON u.id = m.user_id
         WHERE m.group_id = ? ORDER BY u.display_name`,
      )
      .all(group.id) as UserRow[];
    return { ...group, members: members.map(mapUser) };
  });
}

export function listCustomLists(db: Database.Database, ownerId: number) {
  const lists = db
    .prepare("SELECT id, name, created_at FROM friend_lists WHERE owner_id = ? ORDER BY name")
    .all(ownerId) as { id: number; name: string; created_at: string }[];
  return lists.map((list) => {
    const members = db
      .prepare(
        `SELECT u.* FROM friend_list_members m JOIN users u ON u.id = m.user_id
         WHERE m.list_id = ? ORDER BY u.display_name`,
      )
      .all(list.id) as UserRow[];
    return { ...list, members: members.map(mapUser) };
  });
}

export function pendingIncoming(db: Database.Database, userId: number) {
  const rows = db
    .prepare(
      `SELECT f.id, u.* FROM friendships f JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`,
    )
    .all(userId) as (UserRow & { id: number })[];
  return rows.map((row) => ({ requestId: row.id, user: mapUser(row) }));
}

export function pendingOutgoing(db: Database.Database, userId: number) {
  const rows = db
    .prepare(
      `SELECT f.id, u.* FROM friendships f JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`,
    )
    .all(userId) as (UserRow & { id: number })[];
  return rows.map((row) => ({ requestId: row.id, user: mapUser(row) }));
}

export function listAllowIds(db: Database.Database, userId: number) {
  const rows = db.prepare("SELECT allowed_id FROM share_allow WHERE user_id = ?").all(userId) as { allowed_id: number }[];
  return new Set(rows.map((row) => row.allowed_id));
}

export function listBlocks(db: Database.Database, userId: number) {
  const rows = db
    .prepare(
      `SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ? ORDER BY u.display_name`,
    )
    .all(userId) as UserRow[];
  return rows.map(mapUser);
}

export function requestFriend(db: Database.Database, fromId: number, toUsername: string) {
  const from = mustUser(db, fromId);
  if (from.suspended) throw new Error("This account is suspended.");
  const to = getUserByUsername(db, toUsername.trim().toLowerCase());
  if (!to) throw new Error("No one uses that username.");
  if (to.id === fromId) throw new Error("You are already yourself.");
  if (isBlocked(db, fromId, to.id)) throw new Error("A block stops this request.");
  if (areFriends(db, fromId, to.id)) throw new Error(`You and ${to.displayName} are already friends.`);
  const existing = db
    .prepare(
      `SELECT id, status, requester_id FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
    )
    .get(fromId, to.id, to.id, fromId) as { id: number; status: string; requester_id: number } | undefined;
  if (existing?.status === "pending") {
    throw new Error("There is already a request between you.");
  }
  if (to.whoCanAdd === "nobody") {
    throw new Error(`${to.displayName} is not accepting friend requests.`);
  }
  if (to.whoCanAdd === "friends_of_friends" && !sharesAFriend(db, fromId, to.id)) {
    throw new Error(`${to.displayName} only accepts requests from friends of friends.`);
  }
  db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)`,
  ).run(fromId, to.id, new Date().toISOString());
  return to;
}

export function acceptFriend(db: Database.Database, userId: number, requestId: number) {
  const row = db.prepare("SELECT * FROM friendships WHERE id = ?").get(requestId) as
    | { id: number; requester_id: number; addressee_id: number; status: string }
    | undefined;
  if (!row || row.addressee_id !== userId || row.status !== "pending") {
    throw new Error("That request is not waiting on you.");
  }
  db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(requestId);
}

export function declineFriend(db: Database.Database, userId: number, requestId: number) {
  const row = db.prepare("SELECT * FROM friendships WHERE id = ?").get(requestId) as
    | { addressee_id: number; requester_id: number; status: string }
    | undefined;
  if (!row || row.status !== "pending" || (row.addressee_id !== userId && row.requester_id !== userId)) {
    throw new Error("That request is not yours to close.");
  }
  db.prepare("DELETE FROM friendships WHERE id = ?").run(requestId);
}

export function removeFriend(db: Database.Database, userId: number, otherId: number) {
  db.prepare(
    `DELETE FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
  ).run(userId, otherId, otherId, userId);
}

export function blockUser(db: Database.Database, userId: number, otherId: number) {
  if (userId === otherId) throw new Error("You cannot block yourself.");
  mustUser(db, otherId);
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").run(userId, otherId, now);
  db.prepare(
    `DELETE FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  ).run(userId, otherId, otherId, userId);
}

export function unblockUser(db: Database.Database, userId: number, otherId: number) {
  db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").run(userId, otherId);
}

export function createGroup(db: Database.Database, ownerId: number, name: string, memberIds: number[], allowsInbound: boolean) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the group.");
  const info = db
    .prepare(
      `INSERT INTO friend_groups (owner_id, name, allows_inbound_share, created_at) VALUES (?, ?, ?, ?)`,
    )
    .run(ownerId, trimmed.slice(0, 60), allowsInbound ? 1 : 0, new Date().toISOString());
  const groupId = Number(info.lastInsertRowid);
  for (const memberId of memberIds) {
    if (!areFriends(db, ownerId, memberId)) continue;
    db.prepare("INSERT OR IGNORE INTO friend_group_members (group_id, user_id) VALUES (?, ?)").run(groupId, memberId);
  }
  return groupId;
}

export function deleteGroup(db: Database.Database, ownerId: number, groupId: number) {
  db.prepare("DELETE FROM friend_groups WHERE id = ? AND owner_id = ?").run(groupId, ownerId);
}

export function createList(db: Database.Database, ownerId: number, name: string, memberIds: number[]) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the list.");
  const info = db
    .prepare("INSERT INTO friend_lists (owner_id, name, created_at) VALUES (?, ?, ?)")
    .run(ownerId, trimmed.slice(0, 60), new Date().toISOString());
  const listId = Number(info.lastInsertRowid);
  for (const memberId of memberIds) {
    if (!areFriends(db, ownerId, memberId)) continue;
    db.prepare("INSERT OR IGNORE INTO friend_list_members (list_id, user_id) VALUES (?, ?)").run(listId, memberId);
  }
  return listId;
}

export function deleteList(db: Database.Database, ownerId: number, listId: number) {
  db.prepare("DELETE FROM friend_lists WHERE id = ? AND owner_id = ?").run(listId, ownerId);
}

export function updateProfile(
  db: Database.Database,
  userId: number,
  input: { displayName: string; bio: string; avatarColor: string },
) {
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Use a name people will recognize.");
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  db.prepare("UPDATE users SET display_name = ?, bio = ?, avatar_color = ?, initials = ? WHERE id = ?").run(
    displayName.slice(0, 80),
    input.bio.trim().slice(0, 280),
    input.avatarColor,
    initials || "•",
    userId,
  );
}

export function updatePrivacy(
  db: Database.Database,
  userId: number,
  input: {
    whoCanShare: SharePolicy;
    whoCanAdd: AddPolicy;
    whoCanReshare: ResharePolicy;
    allowListIds: number[];
    inboundGroupIds: number[];
  },
) {
  db.prepare("UPDATE users SET who_can_share = ?, who_can_add = ?, who_can_reshare = ? WHERE id = ?").run(
    input.whoCanShare,
    input.whoCanAdd,
    input.whoCanReshare,
    userId,
  );
  db.prepare("DELETE FROM share_allow WHERE user_id = ?").run(userId);
  for (const id of input.allowListIds) {
    if (areFriends(db, userId, id)) {
      db.prepare("INSERT OR IGNORE INTO share_allow (user_id, allowed_id) VALUES (?, ?)").run(userId, id);
    }
  }
  db.prepare("UPDATE friend_groups SET allows_inbound_share = 0 WHERE owner_id = ?").run(userId);
  for (const groupId of input.inboundGroupIds) {
    db.prepare("UPDATE friend_groups SET allows_inbound_share = 1 WHERE id = ? AND owner_id = ?").run(groupId, userId);
  }
}

export function setDiscoverListing(db: Database.Database, userId: number, postId: number, listed: boolean) {
  const post = getPost(db, postId);
  if (!post || post.authorId !== userId) throw new Error("Only the creator can change the public shelf.");
  db.prepare("UPDATE posts SET listed_on_discover = ? WHERE id = ?").run(listed ? 1 : 0, postId);
}

export function setAllowReshare(db: Database.Database, userId: number, postId: number, allow: boolean) {
  const post = getPost(db, postId);
  if (!post || post.authorId !== userId) throw new Error("Only the creator can change resharing.");
  db.prepare("UPDATE posts SET allow_reshare = ? WHERE id = ?").run(allow ? 1 : 0, postId);
}

export function relationship(db: Database.Database, viewerId: number, otherId: number) {
  if (viewerId === otherId) return "self" as const;
  if (isBlocked(db, viewerId, otherId)) {
    const iBlocked = db
      .prepare("SELECT 1 AS ok FROM blocks WHERE blocker_id = ? AND blocked_id = ?")
      .get(viewerId, otherId);
    return iBlocked ? ("blocked" as const) : ("blocked_by" as const);
  }
  if (areFriends(db, viewerId, otherId)) return "friends" as const;
  const pending = db
    .prepare(
      `SELECT requester_id FROM friendships
       WHERE status = 'pending'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
    )
    .get(viewerId, otherId, otherId, viewerId) as { requester_id: number } | undefined;
  if (!pending) return "none" as const;
  return pending.requester_id === viewerId ? ("outgoing" as const) : ("incoming" as const);
}

export function listNotifications(db: Database.Database, userId: number) {
  const rows = db
    .prepare(
      `SELECT n.*, u.display_name AS actor_name, u.username AS actor_username, p.kind AS post_kind
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC`,
    )
    .all(userId) as {
    id: number;
    kind: string;
    actor_id: number;
    actor_name: string;
    actor_username: string;
    post_id: number | null;
    post_kind: string | null;
    read: number;
    created_at: string;
  }[];
  return rows.map((row) => {
    let text = `${row.actor_name} shared something with you.`;
    if (row.kind === "shared_onward") text = `${row.actor_name} shared your post onward.`;
    if (row.kind === "reshared_video") text = `${row.actor_name} reshared your video.`;
    return { ...row, text };
  });
}

export function unreadCount(db: Database.Database, userId: number) {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId) as { c: number };
  return row.c;
}

export function markNotificationRead(db: Database.Database, userId: number, notificationId: number) {
  const row = db
    .prepare("SELECT id, post_id FROM notifications WHERE id = ? AND user_id = ?")
    .get(notificationId, userId) as { id: number; post_id: number | null } | undefined;
  if (!row) return null;
  db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(notificationId);
  return row.post_id;
}

export function markAllNotificationsRead(db: Database.Database, userId: number) {
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
}

export function canViewPost(db: Database.Database, viewer: User, post: Post) {
  if (post.authorId === viewer.id) return true;
  if (post.hidden) {
    return hasPermission(db, viewer.id, "view_reported_content") || hasPermission(db, viewer.id, "moderate_content");
  }
  if (hasShareTo(db, post.id, viewer.id)) return true;
  if (post.listedOnDiscover === 1 && !isBlocked(db, viewer.id, post.authorId)) return true;
  if (hasPermission(db, viewer.id, "view_reported_content") || hasPermission(db, viewer.id, "moderate_content")) {
    return true;
  }
  return false;
}

export function shareHistory(db: Database.Database, postId: number) {
  return db
    .prepare(
      `SELECT s.id, s.created_at, s.note, s.share_kind, s.to_user_id, s.from_user_id,
              fu.display_name AS from_name, tu.display_name AS to_name, g.name AS group_name
       FROM shares s
       JOIN users fu ON fu.id = s.from_user_id
       JOIN users tu ON tu.id = s.to_user_id
       LEFT JOIN friend_groups g ON g.id = s.group_id
       WHERE s.post_id = ?
       ORDER BY s.created_at ASC, s.id ASC`,
    )
    .all(postId) as {
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

export function sentActivity(db: Database.Database, userId: number) {
  return db
    .prepare(
      `SELECT s.created_at, s.to_user_id, tu.display_name AS to_name, p.kind, p.id AS post_id
       FROM shares s
       JOIN users tu ON tu.id = s.to_user_id
       JOIN posts p ON p.id = s.post_id
       WHERE s.from_user_id = ?
       ORDER BY s.created_at DESC LIMIT 8`,
    )
    .all(userId) as {
    created_at: string;
    to_user_id: number;
    to_name: string;
    kind: string;
    post_id: number;
  }[];
}

export function publicPostsBy(db: Database.Database, authorId: number) {
  const rows = db
    .prepare(
      `SELECT * FROM posts WHERE author_id = ? AND listed_on_discover = 1 AND hidden = 0
       ORDER BY created_at DESC`,
    )
    .all(authorId) as PostRow[];
  return rows.map(mapPost);
}

export function createTicket(db: Database.Database, userId: number, subject: string, body: string) {
  const title = subject.trim();
  const text = body.trim();
  if (title.length < 3) throw new Error("Add a subject.");
  if (text.length < 3) throw new Error("Say a little more so support can help.");
  db.prepare("INSERT INTO tickets (user_id, subject, body, status, created_at) VALUES (?, ?, ?, 'open', ?)").run(
    userId,
    title.slice(0, 120),
    text.slice(0, 2000),
    new Date().toISOString(),
  );
}

export const MEDIA_PLATES = [
  { id: "market", label: "North hall, morning light", tone: "#c4a574" },
  { id: "river", label: "River path after rain", tone: "#6e9084" },
  { id: "kitchen", label: "Kitchen table, late", tone: "#d08b6a" },
  { id: "street", label: "Side street at dusk", tone: "#6e7f99" },
] as const;

export const AVATAR_COLORS = ["#00bf8f", "#24527a", "#8a5a2b", "#3f4a3a", "#6b3a55", "#4d463c", "#5c6b73", "#2f2f2f"];
