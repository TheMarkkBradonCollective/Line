import type { Db } from "../lib/db";
import { ROLE_TEMPLATES, type Role } from "../lib/permissions";
import {
  addComment,
  createPost,
  createTicket,
  requestFriend,
  sharePost,
  type ShareRejection,
} from "../lib/social";
import { createReport, escalateReport, updateTicket } from "../lib/staff";
import type { User } from "../lib/types";

type FixtureInput = Parameters<typeof createPost>[2] & {
  mediaLabel?: string | null;
  mediaTone?: string | null;
  photos?: { label: string; tone: string }[] | null;
};

/**
 * Test-only posts. Media posts point at fixture paths in the author's folder; no files exist
 * behind them and the test never fetches them. Fixtures never touch the live database.
 */
async function fixturePost(db: Db, authorId: number, input: FixtureInput) {
  const { mediaLabel: _label, mediaTone: _tone, photos, ...rest } = input;
  void _label;
  void _tone;
  const count = rest.kind === "photo" ? Math.max(1, photos?.length ?? 1) : rest.kind === "text" ? 0 : 1;
  const video = rest.kind === "video" || rest.kind === "reel";
  const frames = Array.from({ length: count }, (_, index) => ({
    path: `u/${authorId}/fixture-${rest.seedKey ?? "post"}-${index}.${video ? "mp4" : "jpg"}`,
    mime: video ? "video/mp4" : "image/jpeg",
  }));
  return createPost(db, authorId, { ...rest, frames });
}

function at(minute: number) {
  return new Date(Date.UTC(2026, 3, 12, 14, minute, 0)).toISOString();
}

async function insertUser(db: Db,
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
  const id = await db.insert(`INSERT INTO profiles
        (username, display_name, bio, avatar_color, initials, role, who_can_share, who_can_add, who_can_reshare, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [input.username,
      input.displayName,
      input.bio,
      input.color,
      input.initials,
      input.role ?? "user",
      input.whoCanShare ?? "friends",
      input.whoCanAdd ?? "everyone",
      input.whoCanReshare ?? "recipients",
      at(0)]);
  const role = input.role ?? "user";
  for (const permission of ROLE_TEMPLATES[role]) {
    await db.run("INSERT INTO permissions (user_id, permission) VALUES (?, ?)", [id, permission]);
  }
  return id;
}

async function user(db: Db, username: string): Promise<User> {
  const row = await db.get("SELECT * FROM profiles WHERE username = ?", [username]) as {
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
    location: string;
    work: string;
    education: string;
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
    location: row.location,
    work: row.work,
    education: row.education,
    restricted: row.restricted,
    suspended: row.suspended,
    createdAt: row.created_at,
  };
}

async function connect(db: Db, a: number, b: number) {
  await db.run("INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'accepted', ?)", [a, b, at(1)]);
}

async function mustShare(db: Db,
  input: Parameters<typeof sharePost>[1],
) {
  const result = await sharePost(db, input);
  if (result.rejected.length) {
    const why = result.rejected.map((item: ShareRejection) => `${item.name}: ${item.reason}`).join(" ");
    throw new Error(`Seed share failed. ${why}`);
  }
  return result;
}

async function getPostId(db: Db, seedKey: string) {
  const row = await db.get("SELECT id FROM posts WHERE seed_key = ?", [seedKey]) as { id: number } | undefined;
  if (!row) throw new Error(`Seed post ${seedKey} is missing.`);
  return row.id;
}

/** Demo world. Called only on an empty database. */
export async function seed(db: Db) {
  const settings: [string, string][] = [
    ["sharing_paused", "0"],
    ["signups_open", "0"],
    ["site_tagline", "Sent, not served."],
    ["staff_reason_required", "1"],
    ["security_note", "Email, SMS, and password sign-in are not connected."],
    ["billing_note", ""],
    ["ownership_note", "LINE is held by the founder seat. Administrator is not the owner."],
  ];
  for (const [key, value] of settings) await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);

  await insertUser(db, {
    username: "marcus",
    displayName: "Marcus Hale",
    bio: "Bikes, bread, and the river path. If you can see one of my posts, I shared it with you.",
    color: "#00bf8f",
    initials: "MH",
  });
  await insertUser(db, {
    username: "jordan",
    displayName: "Jordan Ell",
    bio: "Saturday kitchen, and a few people I actually pass things to.",
    color: "#a33b2b",
    initials: "JE",
  });
  await insertUser(db, {
    username: "alex",
    displayName: "Alex Ruiz",
    bio: "Friend requests only from friends of friends. My feed is whatever people hand me.",
    color: "#24527a",
    initials: "AR",
    whoCanAdd: "friends_of_friends",
  });
  await insertUser(db, {
    username: "sam",
    displayName: "Sam Okonkwo",
    bio: "Reshares stay with friends. I keep the loaf notes short.",
    color: "#8a5a2b",
    initials: "SO",
    whoCanReshare: "friends",
  });
  await insertUser(db, {
    username: "riley",
    displayName: "Riley Chen",
    bio: "Market notes go to the people I pick. I’m not accepting shares right now.",
    color: "#6b3a55",
    initials: "RC",
    whoCanShare: "nobody",
  });
  await insertUser(db, {
    username: "noah",
    displayName: "Noah Park",
    bio: "Short loops from the hall and the bowl. If it’s in your feed, I sent it.",
    color: "#24527a",
    initials: "NP",
  });
  await insertUser(db, {
    username: "mina",
    displayName: "Mina Cho",
    bio: "Dusk walks and one take. I share with the people who were there.",
    color: "#c44b7a",
    initials: "MC",
  });
  await insertUser(db, {
    username: "theo",
    displayName: "Theo Brooks",
    bio: "Creek, rain, and the long way home. I pass things to Jordan and Marcus.",
    color: "#1a936f",
    initials: "TB",
  });
  await insertUser(db, {
    username: "priya",
    displayName: "Priya Nair",
    bio: "Cardamom buns and the Saturday table. Photos go to Sam and Alex.",
    color: "#e05a33",
    initials: "PN",
  });

  await insertUser(db, {
    username: "casey",
    displayName: "Casey Ng",
    bio: "User Support. Tickets and account lookup. No moderation queue.",
    color: "#3f4a3a",
    initials: "CN",
    role: "user_support",
  });
  await insertUser(db, {
    username: "quinn",
    displayName: "Quinn Adler",
    bio: "Moderator. I can review reports and hide a post. I cannot restrict or suspend.",
    color: "#24527a",
    initials: "QA",
    role: "moderator",
  });
  await insertUser(db, {
    username: "avery",
    displayName: "Avery Shah",
    bio: "Senior Moderator. Reports, hides, and restrictions. Suspension is a step above me.",
    color: "#00bf8f",
    initials: "AS",
    role: "senior_moderator",
  });
  await insertUser(db, {
    username: "morgan",
    displayName: "Morgan Blake",
    bio: "Manager. I can suspend, read the audit log, and take escalated cases.",
    color: "#8a5a2b",
    initials: "MB",
    role: "manager",
  });
  await insertUser(db, {
    username: "blake",
    displayName: "Blake Ivers",
    bio: "Director. Platform settings and the staff list. I do not create accounts or change grants.",
    color: "#6b3a55",
    initials: "BI",
    role: "director",
  });
  await insertUser(db, {
    username: "rowan",
    displayName: "Rowan Ellis",
    bio: "Administrator. Privileged staff, not the owner. I cannot hold or grant platform ownership.",
    color: "#4d463c",
    initials: "RE",
    role: "administrator",
  });
  await insertUser(db, {
    username: "sage",
    displayName: "Sage Okada",
    bio: "Founder. The ownership seat. This is not a normal staff title.",
    color: "#1c1915",
    initials: "SO",
    role: "founder",
  });

  const about: [string, string, string, string][] = [
    ["marcus", "Portland, Oregon", "Bike mechanic at Hale & Sons", "Portland Community College"],
    ["jordan", "Portland, Oregon", "Line cook, Saturday kitchen", "Le Cordon Bleu"],
    ["alex", "Seattle, Washington", "Product designer", "University of Washington"],
    ["sam", "Portland, Oregon", "Baker at Crumb Street", ""],
    ["riley", "Tacoma, Washington", "Runs the north hall market stall", ""],
    ["noah", "Portland, Oregon", "Skate coach", "Reed College"],
    ["mina", "Seattle, Washington", "Photographer", "Cornish College of the Arts"],
    ["theo", "Bend, Oregon", "River guide", "Oregon State University"],
    ["priya", "Portland, Oregon", "Pastry chef", "Portland State University"],
  ];
  for (const [username, location, work, education] of about) {
    await db.run("UPDATE profiles SET location = ?, work = ?, education = ? WHERE username = ?", [location, work, education, username]);
  }

  const marcus = await user(db, "marcus");
  const jordan = await user(db, "jordan");
  const alex = await user(db, "alex");
  const sam = await user(db, "sam");
  const riley = await user(db, "riley");
  const noah = await user(db, "noah");
  const mina = await user(db, "mina");
  const theo = await user(db, "theo");
  const priya = await user(db, "priya");
  const casey = await user(db, "casey");
  const quinn = await user(db, "quinn");
  const avery = await user(db, "avery");

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
    await connect(db, pair[0].id, pair[1].id);
  }

  await requestFriend(db, riley.id, "jordan");

  const saturday = await db.insert("INSERT INTO friend_groups (owner_id, name, allows_inbound_share, created_at) VALUES (?, 'Saturday kitchen', 1, ?)", [jordan.id, at(2)]);
  await db.run("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)", [saturday, alex.id]);
  await db.run("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)", [saturday, sam.id]);

  const close = await db.insert("INSERT INTO friend_groups (owner_id, name, allows_inbound_share, created_at) VALUES (?, 'Just Jordan', 1, ?)", [marcus.id, at(2)]);
  await db.run("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)", [close, jordan.id]);

  const listId = await db.insert("INSERT INTO friend_lists (owner_id, name, created_at) VALUES (?, 'River notes', ?)", [marcus.id, at(2)]);
  await db.run("INSERT INTO friend_list_members (list_id, user_id) VALUES (?, ?)", [listId, jordan.id]);

  const bread = await fixturePost(db, sam.id, {
    kind: "text",
    body: "The brown loaf needs another ten minutes 🍞 This note goes to Marcus, not the whole friend list.",
    allowReshare: true,
    seedKey: "bread",
    createdAt: at(5),
  });
  await mustShare(db, {
    postId: bread,
    fromUserId: sam.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    createdAt: at(6),
  });

  const river = await fixturePost(db, marcus.id, {
    kind: "text",
    body: "The river path is open again after the rain 🌧️ I am sending this to Jordan and nobody else.",
    allowReshare: true,
    seedKey: "river",
    createdAt: at(10),
  });
  await mustShare(db, {
    postId: river,
    fromUserId: marcus.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    createdAt: at(11),
  });

  const peaches = await fixturePost(db, jordan.id, {
    kind: "photo",
    body: "Brought extra peaches 🍑 Saturday kitchen — Alex and Sam — and not Marcus.",
    mediaLabel: "Kitchen table, late",
    mediaTone: "#ff8fab,#fb6f92",
    photos: [
      { label: "Kitchen table, late", tone: "#ff8fab,#fb6f92" },
      { label: "Peaches in the bowl", tone: "#ffb703,#fb6f92" },
    ],
    allowReshare: true,
    seedKey: "peaches",
    createdAt: at(20),
  });
  await mustShare(db, {
    postId: peaches,
    fromUserId: jordan.id,
    recipients: [
      { userId: alex.id, shareKind: "group", groupId: saturday },
      { userId: sam.id, shareKind: "group", groupId: saturday },
    ],
    createdAt: at(21),
  });

  const timer = await fixturePost(db, jordan.id, {
    kind: "reel",
    body: "Twelve seconds of the kitchen timer ⏱️ Saturday kitchen, same two people.",
    mediaLabel: "Kitchen table, late",
    mediaTone: "#ff8fab,#fb6f92",
    allowReshare: true,
    seedKey: "timer",
    createdAt: at(24),
  });
  await mustShare(db, {
    postId: timer,
    fromUserId: jordan.id,
    recipients: [
      { userId: alex.id, shareKind: "group", groupId: saturday },
      { userId: sam.id, shareKind: "group", groupId: saturday },
    ],
    createdAt: at(25),
  });

  await mustShare(db, {
    postId: bread,
    fromUserId: marcus.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    note: "You should see this loaf note.",
    createdAt: at(40),
  });

  const gate = await fixturePost(db, marcus.id, {
    kind: "text",
    body: "The side gate lock sticks. I kept this to myself and did not share it with anyone.",
    allowReshare: false,
    seedKey: "gate",
    createdAt: at(50),
  });
  await mustShare(db, {
    postId: gate,
    fromUserId: marcus.id,
    recipients: [{ userId: marcus.id, shareKind: "self" }],
    createdAt: at(51),
  });

  const market = await fixturePost(db, riley.id, {
    kind: "photo",
    body: "Sunday market, north hall 🍋 This one is for Marcus. It does not go anywhere else unless he passes it on.",
    mediaLabel: "North hall, morning light",
    mediaTone: "#ffb703,#fb8500",
    allowReshare: true,
    seedKey: "market",
    createdAt: at(8),
  });
  await mustShare(db, {
    postId: market,
    fromUserId: riley.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    createdAt: at(8),
  });
  const reel = await fixturePost(db, riley.id, {
    kind: "reel",
    body: "The hall filling up before the stalls open. This loop goes to Noah.",
    mediaLabel: "How the hall fills up",
    mediaTone: "#ff5d8f,#ff9e00",
    allowReshare: true,
    seedKey: "hall-reel",
    createdAt: at(9),
  });
  await mustShare(db, {
    postId: reel,
    fromUserId: riley.id,
    recipients: [{ userId: noah.id, shareKind: "direct" }],
    createdAt: at(9),
  });

  const creek = await fixturePost(db, theo.id, {
    kind: "video",
    body: "The creek is loud after the rain. Jordan, this is the long way home 🌊",
    mediaLabel: "Creek under the bridge",
    mediaTone: "#2ec4b6,#1a936f",
    allowReshare: true,
    seedKey: "creek",
    createdAt: at(30),
  });
  await mustShare(db, {
    postId: creek,
    fromUserId: theo.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    createdAt: at(31),
  });

  const buns = await fixturePost(db, priya.id, {
    kind: "photo",
    body: "Cardamom buns, still warm. Sam and Alex, come take one before they are gone.",
    mediaLabel: "Tray of cardamom buns",
    mediaTone: "#f4a261,#e76f51",
    photos: [
      { label: "Tray of cardamom buns", tone: "#f4a261,#e76f51" },
      { label: "Buns on the rack", tone: "#e09f3e,#9c6644" },
      { label: "The last one", tone: "#ffb703,#e76f51" },
    ],
    allowReshare: true,
    seedKey: "buns",
    createdAt: at(32),
  });
  await mustShare(db, {
    postId: buns,
    fromUserId: priya.id,
    recipients: [
      { userId: sam.id, shareKind: "direct" },
      { userId: alex.id, shareKind: "direct" },
    ],
    createdAt: at(33),
  });

  const dusk = await fixturePost(db, mina.id, {
    kind: "reel",
    body: "One loop around the block until the light hits 🌇 For Alex.",
    mediaLabel: "Side street at dusk",
    mediaTone: "#7b2cbf,#c77dff",
    allowReshare: true,
    seedKey: "dusk",
    createdAt: at(34),
  });
  await mustShare(db, {
    postId: dusk,
    fromUserId: mina.id,
    recipients: [{ userId: alex.id, shareKind: "direct" }],
    createdAt: at(35),
  });

  const bowl = await fixturePost(db, noah.id, {
    kind: "reel",
    body: "Painted bowl behind the hall. Jordan, you said you wanted the line.",
    mediaLabel: "Painted skate bowl",
    mediaTone: "#ff5d8f,#ff9e00",
    allowReshare: true,
    seedKey: "bowl",
    createdAt: at(36),
  });
  await mustShare(db, {
    postId: bowl,
    fromUserId: noah.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    createdAt: at(37),
  });

  const crackle = await fixturePost(db, sam.id, {
    kind: "video",
    body: "Listen to the crackle. Marcus, the loaf is almost there.",
    mediaLabel: "Cracked loaf, warm",
    mediaTone: "#e09f3e,#9c6644",
    allowReshare: false,
    seedKey: "crackle",
    createdAt: at(38),
  });
  await mustShare(db, {
    postId: crackle,
    fromUserId: sam.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    createdAt: at(39),
  });

  // A few more things Marcus made, each sent to specific friends, so his profile grid has some life.
  type SeedPost = {
    key: string;
    kind: "photo" | "video" | "reel" | "text";
    body: string;
    label?: string;
    tone?: string;
    photos?: { label: string; tone: string }[];
    to: User[];
    minute: number;
  };
  const marcusPosts: SeedPost[] = [
    {
      key: "bridge",
      kind: "photo",
      body: "Bridge lights came on early tonight.",
      label: "Bridge at blue hour",
      tone: "#48cae4,#023e8a",
      photos: [
        { label: "Bridge at blue hour", tone: "#48cae4,#023e8a" },
        { label: "River path after rain", tone: "#48cae4,#0077b6" },
      ],
      to: [theo, jordan],
      minute: 42,
    },
    { key: "coffee", kind: "photo", body: "Market coffee before the stalls open ☕", label: "Morning market coffee", tone: "#ffb703,#e85d04", to: [alex], minute: 44 },
    { key: "porch", kind: "reel", body: "Porch rain, six seconds, on repeat.", label: "Porch in the rain", tone: "#2ec4b6,#1a936f", to: [sam], minute: 46 },
    { key: "toast", kind: "text", body: "To whoever oiled the side gate: you are a hero.", tone: "#00bf8f,#007a5c", to: [jordan], minute: 48 },
    { key: "ride", kind: "video", body: "Rode the river loop with the new wheel. Two minutes of gravel and geese.", label: "River loop by bike", tone: "#00bf8f,#24527a", to: [jordan, theo], minute: 56 },
  ];
  for (const item of marcusPosts) {
    const id = await fixturePost(db, marcus.id, {
      kind: item.kind,
      body: item.body,
      mediaLabel: item.label ?? null,
      mediaTone: item.tone ?? null,
      photos: item.photos ?? null,
      allowReshare: true,
      seedKey: item.key,
      createdAt: at(item.minute),
    });
    await mustShare(db, {
      postId: id,
      fromUserId: marcus.id,
      recipients: item.to.map((person) => ({ userId: person.id, shareKind: "direct" as const })),
      createdAt: at(item.minute + 1),
    });
    for (const person of item.to) {
      await db.run("INSERT INTO reactions (user_id, post_id, kind, created_at) VALUES (?, ?, 'like', ?)", [person.id, id, at(item.minute + 2)]);
    }
  }

  // Things Jordan and Theo sent Marcus, so their profiles show Marcus a partial set.
  const sentToMarcus: (SeedPost & { author: User })[] = [
    { author: jordan, key: "sauce", kind: "video", body: "Sunday sauce, start to finish. Marcus, this is the one you asked about 🍅", label: "Sauce on the stove", tone: "#e05a33,#9c2c13", to: [marcus], minute: 52 },
    { author: jordan, key: "flip", kind: "reel", body: "Pancake flip, take nine. Finally.", label: "Pancake flip", tone: "#ffb703,#e05a33", to: [marcus, alex], minute: 58 },
    { author: jordan, key: "knife", kind: "text", body: "Sharpened every knife in the kitchen tonight. Bring yours Saturday if you want.", to: [marcus], minute: 60 },
    { author: theo, key: "rapids", kind: "reel", body: "Class III on the lower stretch. Hold on.", label: "Rapids, lower stretch", tone: "#2ec4b6,#0077b6", to: [marcus, jordan], minute: 62 },
    { author: theo, key: "camp", kind: "photo", body: "Camp at the bend, before the rain came in.", label: "Camp at the bend", tone: "#1a936f,#24527a", photos: [
      { label: "Camp at the bend", tone: "#1a936f,#24527a" },
      { label: "Creek under the bridge", tone: "#2ec4b6,#1a936f" },
    ], to: [marcus], minute: 64 },
    { author: mina, key: "lanterns", kind: "photo", body: "Night market lanterns. Alex, you would have loved the noise.", label: "Night market lanterns", tone: "#ff4f81,#7b2cbf", to: [alex], minute: 54 },
  ];
  const seeded: Record<string, number> = {};
  for (const item of sentToMarcus) {
    const id = await fixturePost(db, item.author.id, {
      kind: item.kind,
      body: item.body,
      mediaLabel: item.label ?? null,
      mediaTone: item.tone ?? null,
      photos: item.photos ?? null,
      allowReshare: true,
      seedKey: item.key,
      createdAt: at(item.minute),
    });
    seeded[item.key] = id;
    await mustShare(db, {
      postId: id,
      fromUserId: item.author.id,
      recipients: item.to.map((person) => ({ userId: person.id, shareKind: "direct" as const })),
      createdAt: at(item.minute + 1),
    });
  }

  // A three-person share chain: Mina → Alex → Jordan → Marcus.
  // Each hop is a person choosing one friend. Nobody else gets it.
  const rooftop = await fixturePost(db, mina.id, {
    kind: "photo",
    body: "Rooftop at golden hour. The whole street turned orange for four minutes 🧡",
    mediaLabel: "Rooftop, golden hour",
    mediaTone: "#ff9a3c,#ff4f81",
    allowReshare: true,
    seedKey: "rooftop",
    createdAt: at(66),
  });
  await mustShare(db, {
    postId: rooftop,
    fromUserId: mina.id,
    recipients: [{ userId: alex.id, shareKind: "direct" }],
    note: "You missed this, so here it is.",
    createdAt: at(67),
  });
  await mustShare(db, {
    postId: rooftop,
    fromUserId: alex.id,
    recipients: [{ userId: jordan.id, shareKind: "direct" }],
    note: "Mina's roof. Jordan, look at that light.",
    createdAt: at(70),
  });
  await mustShare(db, {
    postId: rooftop,
    fromUserId: jordan.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    note: "This came through Alex. You need it on your wall.",
    createdAt: at(76),
  });

  // Priya → Sam → Marcus: a two-hop pass.
  await mustShare(db, {
    postId: buns,
    fromUserId: sam.id,
    recipients: [{ userId: marcus.id, shareKind: "direct" }],
    note: "Priya's buns. Saving you one.",
    createdAt: at(72),
  });

  const reactions = {
    run: (userId: number, postId: number, kind: string, when: string) =>
      db.run(
        `INSERT INTO reactions (user_id, post_id, kind, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, post_id, kind) DO UPDATE SET created_at = excluded.created_at`,
        [userId, postId, kind, when],
      ),
  };
  const like = { run: (userId: number, postId: number, when: string) => reactions.run(userId, postId, "like", when) };
  await like.run(jordan.id, river, at(12));
  await like.run(marcus.id, bread, at(7));
  await like.run(alex.id, peaches, at(22));
  await like.run(sam.id, peaches, at(23));
  await like.run(marcus.id, market, at(8));
  await like.run(noah.id, reel, at(9));
  await like.run(jordan.id, creek, at(31));
  await like.run(sam.id, buns, at(33));
  await like.run(alex.id, buns, at(34));
  await like.run(alex.id, dusk, at(35));
  await like.run(jordan.id, bowl, at(37));
  await like.run(alex.id, rooftop, at(68));
  await like.run(jordan.id, rooftop, at(71));
  await like.run(mina.id, rooftop, at(69));
  await like.run(sam.id, rooftop, at(73));
  await like.run(theo.id, creek, at(32));
  await like.run(priya.id, buns, at(33));
  await like.run(marcus.id, buns, at(73));
  await like.run(jordan.id, bread, at(41));
  await like.run(sam.id, market, at(9));
  await like.run(mina.id, dusk, at(36));
  await like.run(noah.id, bowl, at(38));
  await like.run(jordan.id, timer, at(26));
  await like.run(alex.id, timer, at(27));
  const react = async (person: User, postId: number, kind: string, minute: number) => {
    await db.run("DELETE FROM reactions WHERE user_id = ? AND post_id = ?", [person.id, postId]);
    await reactions.run(person.id, postId, kind, at(minute));
  };
  await react(mina, rooftop, "love", 69);
  await react(jordan, rooftop, "wow", 71);
  await react(marcus, rooftop, "love", 78);
  await react(marcus, buns, "love", 73);
  await react(marcus, bread, "haha", 7);
  await react(alex, peaches, "love", 22);
  await react(marcus, seeded.sauce, "love", 54);
  await react(marcus, seeded.flip, "haha", 59);
  await react(alex, seeded.flip, "haha", 60);
  await react(marcus, seeded.rapids, "wow", 63);
  await react(jordan, seeded.rapids, "like", 64);
  await react(marcus, seeded.camp, "like", 65);
  await react(theo, await getPostId(db, "ride"), "love", 58);
  await react(jordan, await getPostId(db, "ride"), "like", 59);

  // Comments, with a reply or two. Each one is checked against the same access rule as everything else.
  const comment = (person: User, postId: number, body: string, minute: number, parentId?: number) =>
    addComment(db, person.id, postId, { body, parentId, createdAt: at(minute) });
  const roof1 = await comment(alex, rooftop, "Told you it was worth passing on.", 71);
  await comment(jordan, rooftop, "Four minutes of orange. Unreal.", 77, roof1);
  await comment(marcus, rooftop, "Thank you for sending this my way. That light!", 79);
  await comment(mina, rooftop, "Glad it made it all the way to you, Marcus.", 80);
  const loaf = await comment(marcus, bread, "Ten more minutes and I'm coming over.", 8);
  await comment(sam, bread, "Bring butter.", 9, loaf);
  await comment(jordan, bread, "Marcus sent me this. Save me a slice?", 42);
  await comment(jordan, river, "Walked it this morning. Puddles everywhere.", 13);
  await comment(marcus, river, "Told you. Boots next time.", 14);
  await comment(theo, await getPostId(db, "bridge"), "Blue hour from the bridge never misses.", 44);
  await comment(marcus, seeded.sauce, "Saving this for Sunday.", 55);
  await comment(jordan, seeded.sauce, "Low heat. Don't rush it.", 56);
  await comment(alex, seeded.flip, "Take nine was worth it.", 61);
  await comment(jordan, await getPostId(db, "ride"), "The geese are the best part.", 60);

  await createReport(db, jordan.id, {
    targetType: "profile",
    targetId: riley.id,
    category: "other",
    details: "Sample case for the moderator queue. Nothing from Riley was shared to my timeline.",
  });
  const spam = await createReport(db, alex.id, {
    targetType: "post",
    targetId: market,
    category: "spam",
    details: "Please review Riley's market note. It was shared with Marcus, not with me.",
  });
  await escalateReport(db, quinn, spam, "Needs a senior moderator.");
  await escalateReport(db, avery, spam, "Passing this case to a manager.");

  await createTicket(db, jordan.id, "Who can put things on my timeline?", "I want to limit shares without leaving LINE.");
  const samTicket = await db.insert("INSERT INTO tickets (user_id, subject, body, status, created_at) VALUES (?, ?, ?, 'open', ?)", [sam.id, "Placeholder frame", "The photo is a stand-in. Support should be able to see this ticket.", at(60)]);
  await updateTicket(db, casey, samTicket, "pending", "Acknowledged. Upload is still a placeholder.");
}
