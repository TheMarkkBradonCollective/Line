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
    bio: "Market notes go to the people I pick. I do not accept shares onto my timeline.",
    color: "#6b3a55",
    initials: "RC",
    whoCanShare: "nobody",
  });
  insertUser(db, {
    username: "noah",
    displayName: "Noah Park",
    bio: "Short loops from the hall and the bowl. If it is on your timeline, I sent it.",
    color: "#24527a",
    initials: "NP",
  });
  insertUser(db, {
    username: "mina",
    displayName: "Mina Cho",
    bio: "Dusk walks and one take. I share with the people who were there.",
    color: "#c44b7a",
    initials: "MC",
  });
  insertUser(db, {
    username: "theo",
    displayName: "Theo Brooks",
    bio: "Creek, rain, and the long way home. I pass things to Jordan and Marcus.",
    color: "#1a936f",
    initials: "TB",
  });
  insertUser(db, {
    username: "priya",
    displayName: "Priya Nair",
    bio: "Cardamom buns and the Saturday table. Photos go to Sam and Alex.",
    color: "#e05a33",
    initials: "PN",
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
  const noah = user(db, "noah");
  const mina = user(db, "mina");
  const theo = user(db, "theo");
  const priya = user(db, "priya");
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
    [riley, noah],
    [jordan, noah],
    [jordan, theo],
    [marcus, theo],
    [alex, mina],
    [sam, mina],
    [sam, priya],
    [alex, priya],
    [jordan, priya],
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
    body: "The brown loaf needs another ten minutes 🍞 This note goes to Marcus, not the whole friend list.",
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
    body: "The river path is open again after the rain 🌧️ I am sending this to Jordan and nobody else.",
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
    body: "Brought extra peaches 🍑 Saturday kitchen — Alex and Sam — and not Marcus.",
    mediaLabel: "Kitchen table, late",
    mediaTone: "#ff8fab,#fb6f92",
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

  const timer = createPost(db, jordan.id, {
    kind: "reel",
    body: "Twelve seconds of the kitchen timer ⏱️ Saturday kitchen, same two people.",
    mediaLabel: "Kitchen table, late",
    mediaTone: "#ff8fab,#fb6f92",
    allowReshare: true,
    seedKey: "timer",
    createdAt: at(24),
  });
  mustShare(db, {
    postId: timer,
    fromUserId: jordan.id,
    recipients: [
      { userId: alex.id, shareKind: "group", groupId: saturday },
      { userId: sam.id, shareKind: "group", groupId: saturday },
    ],
    createdAt: at(25),
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
    body: "The side gate lock sticks. I put this on my own timeline and did not send it to anyone.",
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

  const market = createPost(db, riley.id, {
    kind: "photo",
    body: "Sunday market, north hall 🍋 This one is for Marcus. It does not go anywhere else unless he passes it on.",
    mediaLabel: "North hall, morning light",
    mediaTone: "#ffb703,#fb8500",
    allowReshare: true,
    seedKey: "market",
    createdAt: at(8),
  });
  mustShare(db, {
    postId: market,
    fromUserId: riley.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    createdAt: at(8),
  });
  const reel = createPost(db, riley.id, {
    kind: "reel",
    body: "The hall filling up before the stalls open. This loop goes to Noah.",
    mediaLabel: "How the hall fills up",
    mediaTone: "#ff5d8f,#ff9e00",
    allowReshare: true,
    seedKey: "hall-reel",
    createdAt: at(9),
  });
  mustShare(db, {
    postId: reel,
    fromUserId: riley.id,
    recipients: [{ userId: noah.id, shareKind: "direct" }],
    createdAt: at(9),
  });

  const creek = createPost(db, theo.id, {
    kind: "video",
    body: "The creek is loud after the rain. Jordan, this is the long way home 🌊",
    mediaLabel: "Creek under the bridge",
    mediaTone: "#2ec4b6,#1a936f",
    allowReshare: true,
    seedKey: "creek",
    createdAt: at(30),
  });
  mustShare(db, {
    postId: creek,
    fromUserId: theo.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    createdAt: at(31),
  });

  const buns = createPost(db, priya.id, {
    kind: "photo",
    body: "Cardamom buns, still warm. Sam and Alex, come take one before they are gone.",
    mediaLabel: "Tray of cardamom buns",
    mediaTone: "#f4a261,#e76f51",
    allowReshare: true,
    seedKey: "buns",
    createdAt: at(32),
  });
  mustShare(db, {
    postId: buns,
    fromUserId: priya.id,
    recipients: [
      { userId: sam.id, shareKind: "direct" },
      { userId: alex.id, shareKind: "direct" },
    ],
    createdAt: at(33),
  });

  const dusk = createPost(db, mina.id, {
    kind: "short",
    body: "One loop around the block until the light hits 🌇 For Alex.",
    mediaLabel: "Side street at dusk",
    mediaTone: "#7b2cbf,#c77dff",
    allowReshare: true,
    seedKey: "dusk",
    createdAt: at(34),
  });
  mustShare(db, {
    postId: dusk,
    fromUserId: mina.id,
    recipients: [{ userId: alex.id, shareKind: "direct" }],
    createdAt: at(35),
  });

  const bowl = createPost(db, noah.id, {
    kind: "reel",
    body: "Painted bowl behind the hall. Jordan, you said you wanted the line.",
    mediaLabel: "Painted skate bowl",
    mediaTone: "#ff5d8f,#ff9e00",
    allowReshare: true,
    seedKey: "bowl",
    createdAt: at(36),
  });
  mustShare(db, {
    postId: bowl,
    fromUserId: noah.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    createdAt: at(37),
  });

  const crackle = createPost(db, sam.id, {
    kind: "video",
    body: "Listen to the crackle. Marcus, the loaf is almost there.",
    mediaLabel: "Cracked loaf, warm",
    mediaTone: "#e09f3e,#9c6644",
    allowReshare: false,
    seedKey: "crackle",
    createdAt: at(38),
  });
  mustShare(db, {
    postId: crackle,
    fromUserId: sam.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    createdAt: at(39),
  });

  // A few more things Marcus made, each sent to specific friends, so his profile grid has some life.
  const marcusPosts: { key: string; kind: "photo" | "short" | "text"; body: string; label?: string; tone?: string; to: User[]; minute: number }[] = [
    { key: "bridge", kind: "photo", body: "Bridge lights came on early tonight.", label: "Bridge at blue hour", tone: "#48cae4,#023e8a", to: [theo, jordan], minute: 42 },
    { key: "coffee", kind: "photo", body: "Market coffee before the stalls open ☕", label: "Morning market coffee", tone: "#ffb703,#e85d04", to: [alex], minute: 44 },
    { key: "porch", kind: "short", body: "Porch rain, six seconds, on repeat.", label: "Porch in the rain", tone: "#2ec4b6,#1a936f", to: [sam], minute: 46 },
    { key: "toast", kind: "text", body: "To whoever oiled the side gate: you are a hero.", tone: "#00bf8f,#007a5c", to: [jordan], minute: 48 },
  ];
  for (const item of marcusPosts) {
    const id = createPost(db, marcus.id, {
      kind: item.kind,
      body: item.body,
      mediaLabel: item.label ?? null,
      mediaTone: item.tone ?? null,
      allowReshare: true,
      seedKey: item.key,
      createdAt: at(item.minute),
    });
    mustShare(db, {
      postId: id,
      fromUserId: marcus.id,
      recipients: item.to.map((person) => ({ userId: person.id, shareKind: "direct" as const })),
      createdAt: at(item.minute + 1),
    });
    for (const person of item.to) {
      db.prepare("INSERT INTO reactions (user_id, post_id, kind, created_at) VALUES (?, ?, 'like', ?)").run(person.id, id, at(item.minute + 2));
    }
  }

  // A three-person share chain: Mina → Alex → Jordan → Marcus.
  // Each hop is a person choosing one friend. Nobody else gets it.
  const rooftop = createPost(db, mina.id, {
    kind: "photo",
    body: "Rooftop at golden hour. The whole street turned orange for four minutes 🧡",
    mediaLabel: "Rooftop, golden hour",
    mediaTone: "#ff9a3c,#ff4f81",
    allowReshare: true,
    seedKey: "rooftop",
    createdAt: at(66),
  });
  mustShare(db, {
    postId: rooftop,
    fromUserId: mina.id,
    recipients: [{ userId: alex.id, shareKind: "direct" }],
    note: "You missed this, so here it is.",
    createdAt: at(67),
  });
  mustShare(db, {
    postId: rooftop,
    fromUserId: alex.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    note: "Mina's roof. Jordan, look at that light.",
    createdAt: at(70),
  });
  mustShare(db, {
    postId: rooftop,
    fromUserId: jordan.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    note: "This came through Alex. You need it on your wall.",
    createdAt: at(76),
  });

  // Priya → Sam → Marcus: a two-hop pass.
  mustShare(db, {
    postId: buns,
    fromUserId: sam.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    note: "Priya's buns. Saving you one.",
    createdAt: at(72),
  });

  const like = db.prepare(
    "INSERT INTO reactions (user_id, post_id, kind, created_at) VALUES (?, ?, 'like', ?)",
  );
  like.run(jordan.id, river, at(12));
  like.run(marcus.id, bread, at(7));
  like.run(alex.id, peaches, at(22));
  like.run(sam.id, peaches, at(23));
  like.run(marcus.id, market, at(8));
  like.run(noah.id, reel, at(9));
  like.run(jordan.id, creek, at(31));
  like.run(sam.id, buns, at(33));
  like.run(alex.id, buns, at(34));
  like.run(alex.id, dusk, at(35));
  like.run(jordan.id, bowl, at(37));
  like.run(alex.id, rooftop, at(68));
  like.run(jordan.id, rooftop, at(71));
  like.run(mina.id, rooftop, at(69));
  like.run(sam.id, rooftop, at(73));
  like.run(theo.id, creek, at(32));
  like.run(priya.id, buns, at(33));
  like.run(marcus.id, buns, at(73));
  like.run(jordan.id, bread, at(41));
  like.run(sam.id, market, at(9));
  like.run(mina.id, dusk, at(36));
  like.run(noah.id, bowl, at(38));
  like.run(jordan.id, timer, at(26));
  like.run(alex.id, timer, at(27));

  createReport(db, jordan.id, {
    targetType: "profile",
    targetId: riley.id,
    category: "other",
    details: "Sample case for the moderator queue. Nothing from Riley was shared to my timeline.",
  });
  const spam = createReport(db, alex.id, {
    targetType: "post",
    targetId: market,
    category: "spam",
    details: "Please review Riley's market note. It was shared with Marcus, not with me.",
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
