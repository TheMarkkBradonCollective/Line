import fs from "fs";
import { rulesMarkdown } from "../lib/rules";
import type { Db } from "../lib/db";
import { queuesForPermissions, ROLE_TEMPLATES } from "../lib/permissions";
import { seed } from "./fixtures";
import { LINE_TABLES } from "./lib/migrations";
import { withTestDatabase } from "./lib/test-db";
import { canViewPost, canViewProfile, postAccess } from "../lib/access";
import {
  addComment,
  blockUser,
  coreRuleViolations,
  createPost,
  friendSuggestions,
  getHomeFeed,
  getPostBySeedKey,
  getReel,
  getTimeline,
  getUserByUsername,
  hasPermission,
  listComments,
  listPermissions,
  listReels,
  postEngagement,
  profilePosts,
  searchPeople,
  setReaction,
  sharePost,
  unblockUser,
  deletePost,
  follow,
  unfollow,
  getDiscover,
  publishPost,
  shareToFollowers,
  dislikePost,
  undoDislike,
  hideAuthor,
  unhideAuthor,
  listNotifications,
  deleteProfile,
  removeFriend,
  createGroup,
  expandRecipients,
} from "../lib/social";
import { createReport } from "../lib/staff";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function coreRule(db: Db) {
await seed(db);

const marcus = await getUserByUsername(db, "marcus");
const jordan = await getUserByUsername(db, "jordan");
const alex = await getUserByUsername(db, "alex");
const sam = await getUserByUsername(db, "sam");
const riley = await getUserByUsername(db, "riley");
check(marcus && jordan && alex && sam && riley, "seeded people are missing");

const river = await getPostBySeedKey(db, "river");
const market = await getPostBySeedKey(db, "market");
const reel = await getPostBySeedKey(db, "hall-reel");
const peaches = await getPostBySeedKey(db, "peaches");
const bread = await getPostBySeedKey(db, "bread");
const gate = await getPostBySeedKey(db, "gate");
check(river && market && reel && peaches && bread && gate, "seeded posts are missing");

async function ids(username: string) {
  const person = await getUserByUsername(db, username);
  check(person, username);
  return new Set((await getTimeline(db, person.id)).map((item) => item.postId));
}

const jordanTimeline = await ids("jordan");
const alexTimeline = await ids("alex");
const samTimeline = await ids("sam");
const marcusTimeline = await ids("marcus");
const rileyTimeline = await ids("riley");

check(jordanTimeline.has(river.id), "Jordan should have the note Marcus shared only with Jordan");
check(!alexTimeline.has(river.id), "Alex must not see a post that was shared only with Jordan");
check(!samTimeline.has(river.id), "Sam must not see a post that was shared only with Jordan");
check(!marcusTimeline.has(river.id), "Marcus did not publish the river note to his own timeline");
check(!rileyTimeline.has(river.id), "Riley was not a recipient of the river note");

check(alexTimeline.has(peaches.id) && samTimeline.has(peaches.id), "Saturday kitchen should receive the peaches");
check(!marcusTimeline.has(peaches.id) && !jordanTimeline.has(peaches.id), "Peaches were not shared with Marcus or back to Jordan");

check(marcusTimeline.has(bread.id), "Marcus received Sam's loaf note");
check(jordanTimeline.has(bread.id), "Marcus passed the loaf note on to Jordan");
check(!alexTimeline.has(bread.id), "Alex was not a recipient of the loaf note");

check(marcusTimeline.has(gate.id), "Marcus published the gate note to himself");
check(!jordanTimeline.has(gate.id) && !alexTimeline.has(gate.id) && !samTimeline.has(gate.id), "The self-published note stays with Marcus");

check(marcusTimeline.has(market.id), "Riley shared the market photo with Marcus");
check(!alexTimeline.has(market.id) && !samTimeline.has(market.id) && !jordanTimeline.has(market.id), "The market photo was not shared with Alex, Sam, or Jordan");
check(!rileyTimeline.has(market.id), "Riley did not publish the market photo to their own timeline");
check((await ids("noah")).has(reel.id), "Riley shared the hall reel with Noah");
check(!marcusTimeline.has(reel.id) && !jordanTimeline.has(reel.id) && !alexTimeline.has(reel.id), "The hall reel stays with Noah");

const rooftop = await getPostBySeedKey(db, "rooftop");
check(rooftop, "seeded share chain is missing");
const rooftopForMarcus = (await getTimeline(db, marcus.id)).find((item) => item.postId === rooftop.id);
check(rooftopForMarcus, "Jordan passed Mina's rooftop photo to Marcus");
check(
  rooftopForMarcus.chain.map((person) => person.username).join(">") === "mina>alex>jordan",
  "The share chain reads Mina, then Alex, then Jordan",
);
check((await ids("alex")).has(rooftop.id) && (await ids("jordan")).has(rooftop.id), "Each hop in the chain is on that person's timeline");
check(!(await ids("sam")).has(rooftop.id) && !(await ids("mina")).has(rooftop.id), "Nobody outside the chain receives the rooftop photo");

// ---- Facebook-style wiring, same rule: no share, no see ----

async function threw(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

const noah = await getUserByUsername(db, "noah");
const mina = await getUserByUsername(db, "mina");
const morganStaff = await getUserByUsername(db, "morgan");
check(noah && mina && morganStaff, "noah, mina, morgan are seeded");
const timer = await getPostBySeedKey(db, "timer");
const sauce = await getPostBySeedKey(db, "sauce");
const flip = await getPostBySeedKey(db, "flip");
const knife = await getPostBySeedKey(db, "knife");
const bowl = await getPostBySeedKey(db, "bowl");
check(timer && sauce && flip && knife && bowl, "seeded Jordan and Noah posts are missing");

// A friend's profile shows only what was shared with you.
const jordanForMarcus = new Set((await profilePosts(db, marcus.id, jordan.id)).map((item) => item.post.id));
check(jordanForMarcus.has(sauce.id) && jordanForMarcus.has(flip.id) && jordanForMarcus.has(knife.id), "Marcus sees the posts Jordan sent him on Jordan's profile");
check(!jordanForMarcus.has(peaches.id) && !jordanForMarcus.has(timer.id), "Jordan's Saturday kitchen posts never show on his profile for Marcus");
const jordanOwn = new Set((await profilePosts(db, jordan.id, jordan.id)).map((item) => item.post.id));
check(jordanOwn.has(peaches.id) && jordanOwn.has(timer.id) && jordanOwn.has(sauce.id), "Jordan sees all of his own posts on his profile");
const jordanReelsForMarcus = (await profilePosts(db, marcus.id, jordan.id, "reels")).map((item) => item.post.id);
check(jordanReelsForMarcus.length === 1 && jordanReelsForMarcus[0] === flip.id, "The Reels tab on Jordan's profile shows Marcus only the reel Jordan sent him");
const jordanPhotosForMarcus = await profilePosts(db, marcus.id, jordan.id, "photos");
check(jordanPhotosForMarcus.length === 0, "The Photos tab hides the peaches photo Marcus was never sent");

// A non-friend profile is viewable, but empty of anything that was not shared.
check(await canViewProfile(db, marcus.id, noah.id), "Profiles are public to signed-in people");
check((await profilePosts(db, marcus.id, noah.id)).length === 0, "Noah never sent Marcus anything, so Noah's profile shows Marcus no posts");
check((await profilePosts(db, noah.id, noah.id)).some((item) => item.post.id === bowl.id), "Noah still sees his own bowl reel");
const minaForMarcus = (await profilePosts(db, marcus.id, mina.id)).map((item) => item.post.id);
check(minaForMarcus.length === 1 && minaForMarcus[0] === rooftop.id, "Mina is not Marcus's friend; her profile shows him only the rooftop that reached him through the chain");

// A reel not shared with you cannot be fetched by direct URL, media, or the Reels list.
check(await getReel(db, marcus.id, reel.id) === null, "Marcus cannot open Riley's hall reel by id");
check(await postAccess(db, marcus.id, reel.id) === null, "The media gate refuses the hall reel for Marcus");
check(!(await listReels(db, marcus.id)).some((item) => item.post.id === reel.id), "The hall reel is not in Marcus's Reels");
check(await getReel(db, noah.id, reel.id) !== null, "Noah, who was sent the hall reel, can open it");
check((await listReels(db, marcus.id)).some((item) => item.post.id === flip.id), "Marcus's Reels include the reel Jordan sent him");

// Comments and reactions on a post you cannot see stay hidden.
check(await listComments(db, alex.id, river.id) === null, "Alex cannot read comments on the river note he was never sent");
check((await listComments(db, jordan.id, river.id) ?? []).length > 0, "Jordan, who was sent the river note, can read its comments");
check(await threw(() => addComment(db, alex.id, river.id, { body: "sneaking in" })), "Alex cannot comment on the river note");
check(await threw(() => setReaction(db, alex.id, river.id, "love")), "Alex cannot react to the river note");
check(await postEngagement(db, alex.id, river.id) === null, "Reaction and comment counts stay hidden from Alex");
check(!await canViewPost(db, sam.id, rooftop.id), "Sam is outside the rooftop chain");
check(await listComments(db, sam.id, rooftop.id) === null, "Sam cannot read the rooftop comments");

// A reshare chain grants visibility, hop by hop.
check(await canViewPost(db, marcus.id, rooftop.id), "The chain Mina > Alex > Jordan puts the rooftop in front of Marcus");
check((await getHomeFeed(db, marcus.id)).some((item) => item.postId === rooftop.id), "The rooftop is in Marcus's home feed");
check(!(await getHomeFeed(db, sam.id)).some((item) => item.postId === rooftop.id), "The rooftop is not in Sam's home feed");

// The home feed is shares plus your own posts, and nothing else.
const marcusHome = await getHomeFeed(db, marcus.id);
check(marcusHome.some((item) => item.postId === river.id && item.ownPost), "Marcus's own river note is in his home feed");
check(!marcusHome.some((item) => item.postId === peaches.id || item.postId === reel.id), "Marcus's home feed holds nothing that was not sent to him");
check(new Set(marcusHome.map((item) => item.postId)).size === marcusHome.length, "The home feed shows each post once");
for (const person of [marcus, jordan, alex, sam, riley, noah, mina]) {
  for (const item of await getHomeFeed(db, person.id)) {
    check(await canViewPost(db, person.id, item.postId), `${person.username}'s feed item ${item.postId} must pass the access check`);
  }
}

// Staff grants never turn into a feed.
check((await getHomeFeed(db, morganStaff.id)).length === 0, "A manager's home feed is empty; moderation access is not a feed");
check(await postAccess(db, morganStaff.id, river.id) === null, "Staff can't open an unreported post");
check(await postAccess(db, morganStaff.id, market.id) === "staff", "A manager can open a reported post as a case file");
check(!await canViewPost(db, morganStaff.id, river.id), "Case access does not count as seeing the post in lists");
check((await profilePosts(db, morganStaff.id, marcus.id)).length === 0, "Staff profiles views follow the share rule too");

// People search and suggestions return people, never posts.
check((await searchPeople(db, marcus.id, "mina")).some((card) => card.user.id === mina.id), "People search finds Mina by name");
check((await friendSuggestions(db, marcus.id)).every((card) => card.mutual.length > 0), "Suggestions are friends of friends only");

// Blocking closes the profile and the posts.
await blockUser(db, jordan.id, marcus.id);
check(!await canViewProfile(db, marcus.id, jordan.id), "A blocked person cannot view the blocker's profile");
check(!await canViewPost(db, marcus.id, sauce.id), "A block also closes posts that were shared before it");
check((await profilePosts(db, marcus.id, jordan.id)).length === 0, "A blocked person sees nothing on the blocker's profile");
await unblockUser(db, jordan.id, marcus.id);
check(await canViewPost(db, marcus.id, sauce.id), "Unblocking restores what was shared");

const leakedBefore = await coreRuleViolations(db);
check(leakedBefore.length === 0, `Core rule failed before the extra share: ${leakedBefore.join("; ")}`);

const kept = await sharePost(db, {
  postId: market.id,
  fromUserId: marcus.id,
  recipients: [{ userId: alex.id, shareKind: "direct" }],
});
check(kept.rejected.length === 0, `Sharing the market photo should work: ${kept.rejected.map((item) => item.reason).join(" ")}`);
check((await ids("alex")).has(market.id), "After Marcus shares the market post with Alex, it is on Alex's timeline");
check(!(await ids("sam")).has(market.id), "Sharing with Alex must not place the market post on Sam's timeline");
check(!(await ids("jordan")).has(market.id), "Sharing with Alex must not place the market post on Jordan's timeline");
check(!(await ids("riley")).has(market.id), "Passing the market photo to Alex does not put it on Riley's timeline");

const refused = await sharePost(db, {
  postId: market.id,
  fromUserId: marcus.id,
  recipients: [{ userId: riley.id, shareKind: "direct" }],
});
check(refused.created.length === 0, "Riley refuses inbound shares, including from a friend");
check(!(await ids("riley")).has(market.id), "A refused share must not land on the timeline");

const leakedAfter = await coreRuleViolations(db);
check(leakedAfter.length === 0, `Core rule failed after sharing: ${leakedAfter.join("; ")}`);

const casey = await getUserByUsername(db, "casey");
const quinn = await getUserByUsername(db, "quinn");
const avery = await getUserByUsername(db, "avery");
const morgan = await getUserByUsername(db, "morgan");
const blake = await getUserByUsername(db, "blake");
const rowan = await getUserByUsername(db, "rowan");
const sage = await getUserByUsername(db, "sage");
check(casey && quinn && avery && morgan && blake && rowan && sage, "one staff account per role");

async function holds(person: { id: number }, permission: string, expected: boolean) {
  check(
    await hasPermission(db, person.id, permission) === expected,
    `${permission} for user ${person.id} expected ${expected}`,
  );
}

await holds(casey, "manage_support_tickets", true);
await holds(casey, "review_reports", false);
await holds(casey, "suspend_accounts", false);
await holds(quinn, "review_reports", true);
await holds(quinn, "moderate_content", true);
await holds(quinn, "restrict_accounts", false);
await holds(avery, "restrict_accounts", true);
await holds(avery, "suspend_accounts", false);
await holds(morgan, "suspend_accounts", true);
await holds(morgan, "manage_platform_settings", false);
await holds(blake, "manage_platform_settings", true);
await holds(blake, "modify_roles", false);
await holds(blake, "create_staff_accounts", false);
await holds(rowan, "modify_roles", true);
await holds(rowan, "modify_permissions", true);
await holds(rowan, "access_emergency_controls", true);
await holds(rowan, "platform_ownership", false);
await holds(sage, "platform_ownership", true);
await holds(sage, "access_emergency_controls", true);

check(!ROLE_TEMPLATES.administrator.includes("platform_ownership"), "Administrator template must not include ownership");
check(ROLE_TEMPLATES.founder.includes("platform_ownership"), "Founder template includes ownership");

const quinnQueues = queuesForPermissions(await listPermissions(db, quinn.id));
check(quinnQueues.includes("moderator") && !quinnQueues.includes("manager"), "Moderator queue access stays at their grants");
check(!queuesForPermissions(await listPermissions(db, casey.id)).length, "User Support has no report queue");
check(queuesForPermissions(await listPermissions(db, sage.id)).includes("founder"), "Founder can open the ownership queue");
check(
  !queuesForPermissions(await listPermissions(db, rowan.id)).includes("founder"),
  "Administrator does not open the founder queue",
);

await db.run("DELETE FROM permissions WHERE user_id = ? AND permission = 'review_reports'", [quinn.id]);
check((await getUserByUsername(db, "quinn"))?.role === "moderator", "Role title remains after a grant is removed");
check(!await hasPermission(db, quinn.id, "review_reports"), "A role title does not keep a removed permission");
check(!queuesForPermissions(await listPermissions(db, quinn.id)).includes("moderator"), "Queue access follows the grant, not the title");

await db.run("INSERT INTO audit_log (staff_id, staff_role, action, reason, created_at) VALUES (?, 'moderator', 'probe', 'test', ?)", [quinn.id, new Date().toISOString()]);
let deleteBlocked = false;
try {
  await db.run("DELETE FROM audit_log");
} catch (error) {
  deleteBlocked = error instanceof Error && error.message.includes("audit history cannot be erased");
}
check(deleteBlocked, "Staff must not be able to erase audit history");

let updateBlocked = false;
try {
  await db.run("UPDATE audit_log SET reason = 'rewritten'");
} catch (error) {
  updateBlocked = error instanceof Error && error.message.includes("audit history cannot be altered");
}
check(updateBlocked, "Audit history is append-only");

// Uploaded media: a post may only use files from its author's own folder in the private bucket.
check(
  await threw(() => createPost(db, alex.id, { kind: "photo", body: "borrowed", frames: [{ path: `u/${marcus.id}/x.jpg`, mime: "image/jpeg" }], allowReshare: true })),
  "Alex cannot attach a file from Marcus's upload folder",
);
check(
  await threw(() => createPost(db, alex.id, { kind: "video", body: "no clip", frames: [], allowReshare: true })),
  "A video post needs a real uploaded video",
);
check(
  await threw(() => createPost(db, alex.id, { kind: "photo", body: "wrong type", frames: [{ path: `u/${alex.id}/x.mp4`, mime: "video/mp4" }], allowReshare: true })),
  "Photo posts take images only",
);


// ── Follows and the Followers audience ────────────────────────────────────────
async function person(username: string) {
  const id = await db.insert(
    "INSERT INTO profiles (username, display_name, avatar_color, initials) VALUES (?, ?, '#00bf8f', ?)",
    [username, username[0].toUpperCase() + username.slice(1), username.slice(0, 2).toUpperCase()],
  );
  return id;
}
async function befriend(a: number, b: number) {
  await db.run("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')", [a, b]);
}
const ava = await person("ava"); // author
const finn = await person("finn"); // follows Ava, not her friend
const gus = await person("gus"); // Finn's friend
const hal = await person("hal"); // Gus's friend
const ike = await person("ike"); // follows nobody
const ben = await person("ben"); // Ava's friend
await befriend(finn, gus);
await befriend(gus, hal);
await befriend(ava, ben);
await follow(db, finn, ava);

const pub = await publishPost(db, ava, { kind: "text", body: "for my followers", allowReshare: true, choice: { self: false, followers: true, friendIds: [], groupIds: [], listIds: [] } });
const friendsOnly = await publishPost(db, ava, { kind: "text", body: "friends only", allowReshare: true, choice: { self: false, friendIds: [ben], groupIds: [], listIds: [] } });
check(await canViewPost(db, finn, pub.postId), "A follower sees a follower-audience post");
check(!(await canViewPost(db, ike, pub.postId)), "A non-follower does not see a follower-audience post");
check(!(await canViewPost(db, finn, friendsOnly.postId)), "A follower does not see the author's friends-only or direct shares");
check((await getDiscover(db, finn)).some((item) => item.post.id === pub.postId), "Discover shows a followed author's Followers post");
check(!(await getDiscover(db, finn)).some((item) => item.post.id === friendsOnly.postId), "Discover never shows friends-only posts");
check(!(await getHomeFeed(db, finn)).some((item) => item.postId === pub.postId), "A Followers post goes to Discover only, not the follower's Home feed");
check((await getDiscover(db, ike)).length === 0, "Discover is empty when you follow no one");
check((await profilePosts(db, finn, ava)).some((item) => item.post.id === pub.postId), "The author's profile shows a follower their Followers post");
check((await profilePosts(db, ike, ava)).length === 0, "The author's profile shows a non-follower nothing");

// Direct sharing is friends only, even when you follow someone.
const nonFriend = await sharePost(db, { postId: pub.postId, fromUserId: finn, recipients: [{ userId: ava, shareKind: "direct" }] });
check(nonFriend.created.length === 0 && nonFriend.rejected.length === 1, "The server rejects a direct share to a non-friend");
const ownToStranger = await sharePost(db, { postId: friendsOnly.postId, fromUserId: ava, recipients: [{ userId: ike, shareKind: "direct" }] });
check(ownToStranger.created.length === 0, "Even the author can't direct-share to a non-friend");

// A follower can start a friend-to-friend chain; each recipient can pass it on to their friends.
const toGus = await sharePost(db, { postId: pub.postId, fromUserId: finn, recipients: [{ userId: gus, shareKind: "direct" }] });
check(toGus.created.length === 1, "A follower can reshare a Followers post to a friend");
check(await canViewPost(db, gus, pub.postId), "The friend sees the reshared post");
const toHal = await sharePost(db, { postId: pub.postId, fromUserId: gus, recipients: [{ userId: hal, shareKind: "direct" }] });
check(toHal.created.length === 1 && (await canViewPost(db, hal, pub.postId)), "That friend can reshare onward to their friend");
check((await getHomeFeed(db, gus)).some((item) => item.postId === pub.postId && item.sharedBy.id === finn), "A follower's reshare lands on the friend's Home feed, shared by the follower");
check((await getHomeFeed(db, hal)).some((item) => item.postId === pub.postId && item.chain.some((p) => p.id === finn)), "Onward reshares land on Home with the share chain");
check(!(await getDiscover(db, gus)).some((item) => item.post.id === pub.postId), "Reshares never put the post in the recipient's Discover");

// Only the author may use the Followers audience.
await follow(db, ike, finn);
check(await threw(() => shareToFollowers(db, pub.postId, finn)), "A non-author can't send someone else's post to their followers");
check(!(await canViewPost(db, ike, pub.postId)), "Following a resharer gives no access to the post");

// Unfollowing removes Discover visibility.
await unfollow(db, finn, ava);
check(!(await getDiscover(db, finn)).some((item) => item.post.id === pub.postId), "Unfollowing removes the post from Discover");
check(!(await canViewPost(db, finn, pub.postId)), "Unfollowing removes access to a Followers post");
await follow(db, finn, ava);
check(await canViewPost(db, finn, pub.postId), "Future followers see Followers posts");

// Deleting a post removes access and returns its media paths for Storage removal.
check(await threw(() => deletePost(db, finn, pub.postId)), "Only the author can delete a post");
const mediaPost = await createPost(db, ava, { kind: "photo", body: "pic", frames: [{ path: `u/${ava}/a.jpg`, mime: "image/jpeg" }], allowReshare: true });
await shareToFollowers(db, mediaPost, ava);
const removed = await deletePost(db, ava, mediaPost);
check(removed.length === 1 && removed[0] === `u/${ava}/a.jpg`, "Deleting a post hands back its media for removal");
const removedText = await deletePost(db, ava, pub.postId);
check(removedText.length === 0, "text post has no media");
check(!(await canViewPost(db, gus, pub.postId)) && !(await canViewPost(db, finn, pub.postId)), "A deleted post is gone for everyone");
const leftovers = (await db.get("SELECT (SELECT COUNT(*) FROM shares WHERE post_id = ?) + (SELECT COUNT(*) FROM follower_shares WHERE post_id = ?) AS c", [pub.postId, pub.postId])) as { c: number };
check(Number(leftovers.c) === 0, "Deleting a post removes its shares");

// ── Dislike and hiding (private, viewer-only, not a block) ───────────────────
{
  const kim = await person("kim");
  const lou = await person("lou");
  const max = await person("max");
  await befriend(kim, lou);
  await befriend(kim, max);
  await follow(db, lou, kim);
  await follow(db, max, kim);
  const a = await publishPost(db, kim, { kind: "text", body: "one", allowReshare: true, choice: { self: false, followers: true, friendIds: [lou, max], groupIds: [], listIds: [] } });
  const b = await publishPost(db, kim, { kind: "text", body: "two", allowReshare: true, choice: { self: false, followers: true, friendIds: [lou, max], groupIds: [], listIds: [] } });
  const home = async (u: number) => new Set((await getHomeFeed(db, u)).map((i) => i.postId));
  const disc = async (u: number) => new Set((await getDiscover(db, u)).map((i) => i.post.id));
  await dislikePost(db, lou, a.postId);
  check(!(await home(lou)).has(a.postId) && !(await disc(lou)).has(a.postId), "Disliking hides the post from that viewer's Home and Discover");
  check((await home(max)).has(a.postId) && (await disc(max)).has(a.postId), "A dislike hides the post for that viewer only");
  check(await canViewPost(db, lou, a.postId), "Disliking is not a block: the post stays reachable by link");
  const eng = await postEngagement(db, kim, a.postId);
  check(eng && !("dislikeCount" in eng), "Dislikes are never counted publicly");
  check(!(await listNotifications(db, kim)).some((n) => n.kind.includes("dislike")), "The author is never notified of a dislike");
  await undoDislike(db, lou, a.postId);
  check((await home(lou)).has(a.postId), "Undo restores a disliked post");
  await hideAuthor(db, lou, kim);
  check(!(await home(lou)).has(a.postId) && !(await home(lou)).has(b.postId) && (await disc(lou)).size === 0, "Hiding a person hides all their posts in Home and Discover");
  check(await areFriendsTest(kim, lou), "Hiding is not unfriending");
  await unhideAuthor(db, lou, kim);
  check((await home(lou)).has(b.postId) && (await disc(lou)).has(b.postId), "Unhiding restores them");
  check(await threw(() => dislikePost(db, kim, a.postId)), "You can't dislike your own post");
  check(await threw(() => dislikePost(db, ike, a.postId)), "You can't dislike a post you can't see");
}

async function areFriendsTest(x: number, y: number) {
  return Boolean(await db.get("SELECT 1 AS ok FROM friendships WHERE status = 'accepted' AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))", [x, y, y, x]));
}

// ── Edge cases from the audit ────────────────────────────────────────────────
{
  const ned = await person("ned");
  const ola = await person("ola");
  const pia = await person("pia");
  const ray = await person("ray");
  await befriend(ned, ola);
  await befriend(ola, pia);
  await befriend(ned, ray);

  // Unfriending mid-chain: what you already received stays; new direct shares need friendship again.
  const p1 = await publishPost(db, ned, { kind: "text", body: "chain", allowReshare: true, choice: { self: false, friendIds: [ola], groupIds: [], listIds: [] } });
  await sharePost(db, { postId: p1.postId, fromUserId: ola, recipients: [{ userId: pia, shareKind: "direct" }] });
  await removeFriend(db, ned, ola);
  check(await canViewPost(db, ola, p1.postId) && await canViewPost(db, pia, p1.postId), "Unfriending doesn't take back shares already received");
  const p2 = await publishPost(db, ned, { kind: "text", body: "after", allowReshare: true, choice: { self: true, friendIds: [], groupIds: [], listIds: [] } });
  const again = await sharePost(db, { postId: p2.postId, fromUserId: ned, recipients: [{ userId: ola, shareKind: "direct" }] });
  check(again.created.length === 0, "After unfriending, direct shares to that person are refused");

  // Group membership changes: a group share goes to who was in it at send time.
  const gid = await createGroup(db, ned, "crew", [ray], true);
  const g1 = await publishPost(db, ned, { kind: "text", body: "to crew", allowReshare: true, choice: { self: false, friendIds: [], groupIds: [gid], listIds: [] } });
  check(await canViewPost(db, ray, g1.postId), "Group members at send time receive a group share");
  await db.run("INSERT INTO friend_group_members (group_id, user_id) VALUES (?, ?)", [gid, ola]);
  check(!(await canViewPost(db, ola, g1.postId)), "Someone added to a group later doesn't get earlier group shares");
  const g2 = await expandRecipients(db, ned, { self: false, friendIds: [], groupIds: [gid], listIds: [] });
  const g2share = await publishPost(db, ned, { kind: "text", body: "crew 2", allowReshare: true, choice: { self: false, friendIds: [], groupIds: [gid], listIds: [] } });
  check(g2.recipients.length === 2 && !(await canViewPost(db, ola, g2share.postId)), "Group shares still only reach friends (non-friend group members are refused)");

  // Blocks: blocking ends access to shared and Followers posts, and removes follows.
  await follow(db, ray, ned);
  const fp = await publishPost(db, ned, { kind: "text", body: "fol", allowReshare: true, choice: { self: false, followers: true, friendIds: [ray], groupIds: [], listIds: [] } });
  await blockUser(db, ned, ray);
  check(!(await canViewPost(db, ray, fp.postId)), "A block ends access to the blocker's posts, shared or Followers");
  check(!(await db.get("SELECT 1 AS ok FROM follows WHERE follower_id = ? AND followee_id = ?", [ray, ned])), "A block removes follows both ways");
  check(!(await listNotifications(db, ray)).some((n) => n.actor_id === ned), "Notifications from across a block are hidden");
  await unblockUser(db, ned, ray);

  // Notifications never show a post you can no longer see.
  const sv = await publishPost(db, ned, { kind: "text", body: "secret body", allowReshare: true, choice: { self: false, friendIds: [], groupIds: [], listIds: [], followers: true } });
  await follow(db, pia, ned);
  await befriend(pia, ned);
  await sharePost(db, { postId: sv.postId, fromUserId: ned, recipients: [{ userId: pia, shareKind: "direct" }] });
  check((await listNotifications(db, pia)).some((n) => n.post_id === sv.postId), "A share notification shows up");
  await deletePost(db, ned, sv.postId);
  check(!(await listNotifications(db, pia)).some((n) => n.post_id === sv.postId || n.post_body === "secret body"), "Notifications of deleted posts disappear");

  // Reports: you can only report what you can see.
  const hidden = await publishPost(db, ned, { kind: "text", body: "not for ola", allowReshare: true, choice: { self: true, friendIds: [], groupIds: [], listIds: [] } });
  check(await threw(() => createReport(db, ola, { targetType: "post", targetId: hidden.postId, category: "spam", details: "" })), "You can't report a post you can't see");

  // Share counts ignore "just me" self-shares.
  check((await postEngagement(db, ned, hidden.postId))!.shareCount === 0, "A self-share isn't counted as a share");

  // Account deletion removes the profile and everything that hangs off it.
  const gone = await person("gone");
  await befriend(gone, ned);
  const gp = await publishPost(db, gone, { kind: "text", body: "bye", allowReshare: true, choice: { self: false, friendIds: [ned], groupIds: [], listIds: [] } });
  await deleteProfile(db, gone);
  check(!(await canViewPost(db, ned, gp.postId)), "Deleting an account deletes its posts for everyone");
  check(!(await db.get("SELECT 1 AS ok FROM friendships WHERE requester_id = ? OR addressee_id = ?", [gone, gone])), "Deleting an account removes its friendships");
}

// The rules doc matches the in-app rules (single source in lib/rules.ts).
check(fs.readFileSync("docs/RULES.md", "utf8") === rulesMarkdown(), "docs/RULES.md is out of date; run npm run docs:rules");

// Lockdown: RLS on every LINE table and no grants for the browser roles.
for (const table of LINE_TABLES) {
  const row = (await db.get(
    `SELECT c.relrowsecurity AS rls,
            has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT') AS anon,
            has_table_privilege('authenticated', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'UPDATE') AS authed
     FROM pg_class c WHERE c.oid = to_regclass(?)`,
    [table],
  )) as { rls: boolean; anon: boolean; authed: boolean } | undefined;
  check(row, `${table} exists`);
  check(row.rls, `${table} has row level security on`);
  check(!row.anon && !row.authed, `${table} grants nothing to anon or authenticated`);
}

console.log("core rule ok");
console.log("Jordan has the river note. Alex and Sam do not.");
console.log("Marcus can pass Riley's market photo to Alex without Sam or Jordan receiving it.");
console.log("Mina's rooftop photo reached Marcus through Alex and Jordan, and nobody else.");
console.log("Administrator has no platform ownership. Founder does.");
console.log("Jordan's profile shows Marcus only what Jordan sent him. Noah's profile is open but empty for Marcus.");
console.log("Riley's hall reel can't be opened by Marcus by URL, media, or Reels.");
console.log("Comments and reactions on the river note are hidden from Alex.");
  console.log("Followers posts reach current followers only; follower chains go friend to friend; only authors use Followers; direct shares are friends only; delete removes access and media.");
  console.log("Dislikes and hidden people are private and per-viewer; unhide restores. Audit edge cases: unfriending, group changes, blocks, notifications, reports, self-share counts, account deletion.");
  console.log("Posts can only use the author's own uploads. Every table has RLS on and no browser grants.");
}

withTestDatabase(coreRule).catch((error) => {
  console.error(error);
  process.exit(1);
});
