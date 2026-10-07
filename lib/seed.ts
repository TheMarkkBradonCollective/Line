import type Database from "better-sqlite3";
import { ROLE_TEMPLATES, type Role } from "./permissions";
import {
  createPost,
  createTicket,
  requestFriend,
  sharePost,
  type ShareRejection,
} from "./social";
import { createReport, escalateReport, updateTicket } from "./staff";
import type { User } from "./types";

function at(minute: number) {
  return new Date(Date.UTC(2026, 3, 12, 14, minute, 0)).toISOString();
}

function insertUser(
  db: Database.Database,
  input: {
    username: string;
    displayName: string;
    bio: string;
    color: string;
    initials: string;
    role?: Role;
    whoCanShare?: string;
    whoCanAdd?: string;
    whoCanReshare?: string;
  },
) {
  const info = db
    .prepare(
      `INSERT INTO users
        (username, display_name, bio, avatar_color, initials, role, who_can_share, who_can_add, who_can_reshare, default_visibility, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', ?)`,
    )
    .run(
      input.username,
      input.displayName,
      input.bio,
      input.color,
      input.initials,
      input.role ?? "user",
      input.whoCanShare ?? "friends",
      input.whoCanAdd ?? "everyone",
      input.whoCanReshare ?? "recipients",
      at(0),
    );
  const id = Number(info.lastInsertRowid);
  const role = input.role ?? "user";
  const grant = db.prepare("INSERT INTO permissions (user_id, permission) VALUES (?, ?)");
  for (const permission of ROLE_TEMPLATES[role]) grant.run(id, permission);
  return id;
}

function user(db: Database.Database, username: string): User {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as {
    id: number;
    username: string;
    display_name: string;
    bio: string;
    avatar_color: string;
    initials: string;
    role: string;
    who_can_share: User["whoCanShare"];
    who_can_add: User["whoCanAdd"];
    who_can_reshare: User["whoCanReshare"];
    default_visibility: "private" | "public";
    restricted: number;
    suspended: number;
    created_at: string;
  };
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarColor: row.avatar_color,
    initials: row.initials,
    role: row.role,
    whoCanShare: row.who_can_share,
    whoCanAdd: row.who_can_add,
    whoCanReshare: row.who_can_reshare,
    defaultVisibility: row.default_visibility,
    restricted: row.restricted,
    suspended: row.suspended,
    createdAt: row.created_at,
  };
}

function connect(db: Database.Database, a: number, b: number) {
  db.prepare(
    "INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'accepted', ?)",
  ).run(a, b, at(1));
}

function mustShare(
  db: Database.Database,
  input: Parameters<typeof sharePost>[1],
) {
  const result = sharePost(db, input);
  if (result.rejected.length) {
    const why = result.rejected.map((item: ShareRejection) => `${item.name}: ${item.reason}`).join(" ");
    throw new Error(`Seed share failed. ${why}`);
  }
  return result;
}

/** Demo world. Called only on an empty database. */
export function seed(db: Database.Database) {
  const settings: [string, string][] = [
    ["sharing_paused", "0"],
    ["discover_enabled", "1"],
    ["signups_open", "0"],
    ["site_tagline", "Sent, not served."],
    ["staff_reason_required", "1"],
    ["security_note", "Email, SMS, and password sign-in are not connected."],
    ["billing_note", ""],
    ["ownership_note", "LINE is held by the founder seat. Administrator is not the owner."],
  ];
  const put = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of settings) put.run(key, value);

  insertUser(db, {
    username: "marcus",
    displayName: "Marcus Hale",
    bio: "I send notes to specific people. If you are reading this on my profile, I did not put it on your timeline.",
    color: "#00bf8f",
    initials: "MH",
  });
  insertUser(db, {
    username: "jordan",
    displayName: "Jordan Ell",
    bio: "Saturday kitchen, and a few people I actually pass things to.",
    color: "#a33b2b",
    initials: "JE",
  });
  insertUser(db, {
    username: "alex",
    displayName: "Alex Ruiz",
    bio: "Friend requests only from friends of friends. My timeline is whatever people hand me.",
    color: "#24527a",
    initials: "AR",
    whoCanAdd: "friends_of_friends",
  });
  insertUser(db, {
    username: "sam",
    displayName: "Sam Okonkwo",
    bio: "Reshares stay with friends. I keep the loaf notes short.",
    color: "#8a5a2b",
    initials: "SO",
    whoCanReshare: "friends",
  });
  insertUser(db, {
    username: "riley",
    displayName: "Riley Chen",
    bio: "Public market notes. They stay on Discover until someone chooses to pass one on. I do not accept shares onto my timeline.",
    color: "#6b3a55",
    initials: "RC",
    whoCanShare: "nobody",
  });

  insertUser(db, {
    username: "casey",
    displayName: "Casey Ng",
    bio: "User Support. Tickets and account lookup. No moderation queue.",
    color: "#3f4a3a",
    initials: "CN",
    role: "user_support",
  });
  insertUser(db, {
    username: "quinn",
    displayName: "Quinn Adler",
    bio: "Moderator. I can review reports and hide a post. I cannot restrict or suspend.",
    color: "#24527a",
    initials: "QA",
    role: "moderator",
  });
  insertUser(db, {
    username: "avery",
    displayName: "Avery Shah",
    bio: "Senior Moderator. Reports, hides, and restrictions. Suspension is a step above me.",
    color: "#00bf8f",
    initials: "AS",
    role: "senior_moderator",
  });
  insertUser(db, {
    username: "morgan",
    displayName: "Morgan Blake",
    bio: "Manager. I can suspend, read the audit log, and take escalated cases.",
    color: "#8a5a2b",
    initials: "MB",
    role: "manager",
  });
  insertUser(db, {
    username: "blake",
    displayName: "Blake Ivers",
    bio: "Director. Platform settings and the staff list. I do not create accounts or change grants.",
    color: "#6b3a55",
    initials: "BI",
    role: "director",
  });
  insertUser(db, {
    username: "rowan",
    displayName: "Rowan Ellis",
    bio: "Administrator. Privileged staff, not the owner. I cannot hold or grant platform ownership.",
    color: "#4d463c",
    initials: "RE",
    role: "administrator",
  });
  insertUser(db, {
    username: "sage",
    displayName: "Sage Okada",
    bio: "Founder. The ownership seat. This is not a normal staff title.",
    color: "#1c1915",
    initials: "SO",
    role: "founder",
  });

  const marcus = user(db, "marcus");
  const jordan = user(db, "jordan");
  const alex = user(db, "alex");
  const sam = user(db, "sam");
  const riley = user(db, "riley");
  const casey = user(db, "casey");
  const quinn = user(db, "quinn");
  const avery = user(db, "avery");

  for (const pair of [
    [marcus, jordan],
    [marcus, alex],
    [marcus, sam],
    [jordan, alex],
    [jordan, sam],
    [alex, sam],
    [marcus, riley],
  ] as const) {
    connect(db, pair[0].id, pair[1].id);
  }

  requestFriend(db, riley.id, "jordan");

  const saturday = Number(
    db
      .prepare(
        "INSERT INTO friend_groups (owner_id, name, allows_inbound_share, created_at) VALUES (?, 'Saturday kitchen', 1, ?)",
      )
      .run(jordan.id, at(2)).lastInsertRowid,
  );
  db.prepare("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)").run(saturday, alex.id);
  db.prepare("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)").run(saturday, sam.id);

  const close = Number(
    db
      .prepare(
        "INSERT INTO friend_groups (owner_id, name, allows_inbound_share, created_at) VALUES (?, 'Just Jordan', 1, ?)",
      )
      .run(marcus.id, at(2)).lastInsertRowid,
  );
  db.prepare("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)").run(close, jordan.id);

  const listId = Number(
    db
      .prepare("INSERT INTO friend_lists (owner_id, name, created_at) VALUES (?, 'River notes', ?)")
      .run(marcus.id, at(2)).lastInsertRowid,
  );
  db.prepare("INSERT INTO friend_list_members (list_id, user_id) VALUES (?, ?)").run(listId, jordan.id);

  const bread = createPost(db, sam.id, {
    kind: "text",
    body: "The brown loaf needs another ten minutes. This note goes to Marcus, not to the whole friend list.",
    listedOnDiscover: false,
    allowReshare: true,
    seedKey: "bread",
    createdAt: at(5),
  });
  mustShare(db, {
    postId: bread,
    fromUserId: sam.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    createdAt: at(6),
  });

  const river = createPost(db, marcus.id, {
    kind: "text",
    body: "The river path is open again after the rain. I am sending this to Jordan and nobody else.",
    listedOnDiscover: false,
    allowReshare: true,
    seedKey: "river",
    createdAt: at(10),
  });
  mustShare(db, {
    postId: river,
    fromUserId: marcus.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    createdAt: at(11),
  });

  const peaches = createPost(db, jordan.id, {
    kind: "photo",
    body: "Brought extra peaches. This goes to the Saturday kitchen group — Alex and Sam — and not to Marcus.",
    mediaLabel: "Kitchen table, late",
    mediaTone: "#d08b6a",
    listedOnDiscover: false,
    allowReshare: true,
    seedKey: "peaches",
    createdAt: at(20),
  });
  mustShare(db, {
    postId: peaches,
    fromUserId: jordan.id,
    recipients: [
      { userId: alex.id, shareKind: "group", groupId: saturday },
      { userId: sam.id, shareKind: "group", groupId: saturday },
    ],
    createdAt: at(21),
  });

  mustShare(db, {
    postId: bread,
    fromUserId: marcus.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    note: "You should see this loaf note.",
    createdAt: at(40),
  });

  const gate = createPost(db, marcus.id, {
    kind: "text",
    body: "The side gate lock sticks. I published this to my own timeline and did not send it to anyone.",
    listedOnDiscover: false,
    allowReshare: false,
    seedKey: "gate",
    createdAt: at(50),
  });
  mustShare(db, {
    postId: gate,
    fromUserId: marcus.id,
    recipients: [{ userId: marcus.id, shareKind: "self" }],
    createdAt: at(51),
  });

  createPost(db, riley.id, {
    kind: "photo",
    body: "Sunday market, north hall. This is public on Discover. It is not on anyone's timeline until a person shares it.",
    mediaLabel: "North hall, morning light",
    mediaTone: "#c4a574",
    listedOnDiscover: true,
    allowReshare: true,
    seedKey: "market",
    createdAt: at(8),
  });
  createPost(db, riley.id, {
    kind: "reel",
    body: "A short look at the hall filling up. Public on Discover only. Sharing it is how someone keeps it.",
    mediaLabel: "How the hall fills up",
    mediaTone: "#6e7f99",
    listedOnDiscover: true,
    allowReshare: true,
    seedKey: "hall-reel",
    createdAt: at(9),
  });

  const market = db.prepare("SELECT id FROM posts WHERE seed_key = 'market'").get() as { id: number };
  createReport(db, jordan.id, {
    targetType: "profile",
    targetId: riley.id,
    category: "other",
    details: "Sample case for the moderator queue. Riley's public posts are not on my timeline.",
  });
  const spam = createReport(db, alex.id, {
    targetType: "post",
    targetId: market.id,
    category: "spam",
    details: "Please review this Discover post. It was never shared to me.",
  });
  escalateReport(db, quinn, spam, "Needs a senior moderator.");
  escalateReport(db, avery, spam, "Passing this case to a manager.");

  createTicket(db, jordan.id, "Who can put things on my timeline?", "I want to limit shares without leaving LINE.");
  const samTicket = Number(
    db
      .prepare("INSERT INTO tickets (user_id, subject, body, status, created_at) VALUES (?, ?, ?, 'open', ?)")
      .run(sam.id, "Placeholder frame", "The photo is a stand-in. Support should be able to see this ticket.", at(60))
      .lastInsertRowid,
  );
  updateTicket(db, casey, samTicket, "pending", "Acknowledged. Upload is still a placeholder.");
}
