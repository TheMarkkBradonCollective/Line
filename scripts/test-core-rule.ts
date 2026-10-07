import fs from "fs";
import os from "os";
import path from "path";
import { createDatabase } from "../lib/db";
import { queuesForPermissions, ROLE_TEMPLATES } from "../lib/permissions";
import { seed } from "../lib/seed";
import { canViewPost, canViewProfile, postAccess } from "../lib/access";
import {
  addComment,
  blockUser,
  coreRuleViolations,
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
} from "../lib/social";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "line-core-"));
const db = createDatabase(path.join(dir, "line.sqlite"));
seed(db);

const marcus = getUserByUsername(db, "marcus");
const jordan = getUserByUsername(db, "jordan");
const alex = getUserByUsername(db, "alex");
const sam = getUserByUsername(db, "sam");
const riley = getUserByUsername(db, "riley");
check(marcus && jordan && alex && sam && riley, "seeded people are missing");

const river = getPostBySeedKey(db, "river");
const market = getPostBySeedKey(db, "market");
const reel = getPostBySeedKey(db, "hall-reel");
const peaches = getPostBySeedKey(db, "peaches");
const bread = getPostBySeedKey(db, "bread");
const gate = getPostBySeedKey(db, "gate");
check(river && market && reel && peaches && bread && gate, "seeded posts are missing");

function ids(username: string) {
  const person = getUserByUsername(db, username);
  check(person, username);
  return new Set(getTimeline(db, person.id).map((item) => item.postId));
}

const jordanTimeline = ids("jordan");
const alexTimeline = ids("alex");
const samTimeline = ids("sam");
const marcusTimeline = ids("marcus");
const rileyTimeline = ids("riley");

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
check(ids("noah").has(reel.id), "Riley shared the hall reel with Noah");
check(!marcusTimeline.has(reel.id) && !jordanTimeline.has(reel.id) && !alexTimeline.has(reel.id), "The hall reel stays with Noah");

const rooftop = getPostBySeedKey(db, "rooftop");
check(rooftop, "seeded share chain is missing");
const rooftopForMarcus = getTimeline(db, marcus.id).find((item) => item.postId === rooftop.id);
check(rooftopForMarcus, "Jordan passed Mina's rooftop photo to Marcus");
check(
  rooftopForMarcus.chain.map((person) => person.username).join(">") === "mina>alex>jordan",
  "The share chain reads Mina, then Alex, then Jordan",
);
check(ids("alex").has(rooftop.id) && ids("jordan").has(rooftop.id), "Each hop in the chain is on that person's timeline");
check(!ids("sam").has(rooftop.id) && !ids("mina").has(rooftop.id), "Nobody outside the chain receives the rooftop photo");

// ---- Facebook-style wiring, same rule: no share, no see ----

function threw(fn: () => unknown) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const noah = getUserByUsername(db, "noah");
const mina = getUserByUsername(db, "mina");
const morganStaff = getUserByUsername(db, "morgan");
check(noah && mina && morganStaff, "noah, mina, morgan are seeded");
const timer = getPostBySeedKey(db, "timer");
const sauce = getPostBySeedKey(db, "sauce");
const flip = getPostBySeedKey(db, "flip");
const knife = getPostBySeedKey(db, "knife");
const bowl = getPostBySeedKey(db, "bowl");
check(timer && sauce && flip && knife && bowl, "seeded Jordan and Noah posts are missing");

// A friend's profile shows only what was shared with you.
const jordanForMarcus = new Set(profilePosts(db, marcus.id, jordan.id).map((item) => item.post.id));
check(jordanForMarcus.has(sauce.id) && jordanForMarcus.has(flip.id) && jordanForMarcus.has(knife.id), "Marcus sees the posts Jordan sent him on Jordan's profile");
check(!jordanForMarcus.has(peaches.id) && !jordanForMarcus.has(timer.id), "Jordan's Saturday kitchen posts never show on his profile for Marcus");
const jordanOwn = new Set(profilePosts(db, jordan.id, jordan.id).map((item) => item.post.id));
check(jordanOwn.has(peaches.id) && jordanOwn.has(timer.id) && jordanOwn.has(sauce.id), "Jordan sees all of his own posts on his profile");
const jordanReelsForMarcus = profilePosts(db, marcus.id, jordan.id, "reels").map((item) => item.post.id);
check(jordanReelsForMarcus.length === 1 && jordanReelsForMarcus[0] === flip.id, "The Reels tab on Jordan's profile shows Marcus only the reel Jordan sent him");
const jordanPhotosForMarcus = profilePosts(db, marcus.id, jordan.id, "photos");
check(jordanPhotosForMarcus.length === 0, "The Photos tab hides the peaches photo Marcus was never sent");

// A non-friend profile is viewable, but empty of anything that was not shared.
check(canViewProfile(db, marcus.id, noah.id), "Profiles are public to signed-in people");
check(profilePosts(db, marcus.id, noah.id).length === 0, "Noah never sent Marcus anything, so Noah's profile shows Marcus no posts");
check(profilePosts(db, noah.id, noah.id).some((item) => item.post.id === bowl.id), "Noah still sees his own bowl reel");
const minaForMarcus = profilePosts(db, marcus.id, mina.id).map((item) => item.post.id);
check(minaForMarcus.length === 1 && minaForMarcus[0] === rooftop.id, "Mina is not Marcus's friend; her profile shows him only the rooftop that reached him through the chain");

// A reel not shared with you cannot be fetched by direct URL, media, or the Reels list.
check(getReel(db, marcus.id, reel.id) === null, "Marcus cannot open Riley's hall reel by id");
check(postAccess(db, marcus.id, reel.id) === null, "The media gate refuses the hall reel for Marcus");
check(!listReels(db, marcus.id).some((item) => item.post.id === reel.id), "The hall reel is not in Marcus's Reels");
check(getReel(db, noah.id, reel.id) !== null, "Noah, who was sent the hall reel, can open it");
check(listReels(db, marcus.id).some((item) => item.post.id === flip.id), "Marcus's Reels include the reel Jordan sent him");

// Comments and reactions on a post you cannot see stay hidden.
check(listComments(db, alex.id, river.id) === null, "Alex cannot read comments on the river note he was never sent");
check((listComments(db, jordan.id, river.id) ?? []).length > 0, "Jordan, who was sent the river note, can read its comments");
check(threw(() => addComment(db, alex.id, river.id, { body: "sneaking in" })), "Alex cannot comment on the river note");
check(threw(() => setReaction(db, alex.id, river.id, "love")), "Alex cannot react to the river note");
check(postEngagement(db, alex.id, river.id) === null, "Reaction and comment counts stay hidden from Alex");
check(!canViewPost(db, sam.id, rooftop.id), "Sam is outside the rooftop chain");
check(listComments(db, sam.id, rooftop.id) === null, "Sam cannot read the rooftop comments");

// A reshare chain grants visibility, hop by hop.
check(canViewPost(db, marcus.id, rooftop.id), "The chain Mina > Alex > Jordan puts the rooftop in front of Marcus");
check(getHomeFeed(db, marcus.id).some((item) => item.postId === rooftop.id), "The rooftop is in Marcus's home feed");
check(!getHomeFeed(db, sam.id).some((item) => item.postId === rooftop.id), "The rooftop is not in Sam's home feed");

// The home feed is shares plus your own posts, and nothing else.
const marcusHome = getHomeFeed(db, marcus.id);
check(marcusHome.some((item) => item.postId === river.id && item.ownPost), "Marcus's own river note is in his home feed");
check(!marcusHome.some((item) => item.postId === peaches.id || item.postId === reel.id), "Marcus's home feed holds nothing that was not sent to him");
check(new Set(marcusHome.map((item) => item.postId)).size === marcusHome.length, "The home feed shows each post once");
for (const person of [marcus, jordan, alex, sam, riley, noah, mina]) {
  for (const item of getHomeFeed(db, person.id)) {
    check(canViewPost(db, person.id, item.postId), `${person.username}'s feed item ${item.postId} must pass the access check`);
  }
}

// Staff grants never turn into a feed.
check(getHomeFeed(db, morganStaff.id).length === 0, "A manager's home feed is empty; moderation access is not a feed");
check(postAccess(db, morganStaff.id, river.id) === "staff", "A manager can open a post as a case file");
check(!canViewPost(db, morganStaff.id, river.id), "Case access does not count as seeing the post in lists");
check(profilePosts(db, morganStaff.id, marcus.id).length === 0, "Staff profiles views follow the share rule too");

// People search and suggestions return people, never posts.
check(searchPeople(db, marcus.id, "mina").some((card) => card.user.id === mina.id), "People search finds Mina by name");
check(friendSuggestions(db, marcus.id).every((card) => card.mutual.length > 0), "Suggestions are friends of friends only");

// Blocking closes the profile and the posts.
blockUser(db, jordan.id, marcus.id);
check(!canViewProfile(db, marcus.id, jordan.id), "A blocked person cannot view the blocker's profile");
check(!canViewPost(db, marcus.id, sauce.id), "A block also closes posts that were shared before it");
check(profilePosts(db, marcus.id, jordan.id).length === 0, "A blocked person sees nothing on the blocker's profile");
unblockUser(db, jordan.id, marcus.id);
check(canViewPost(db, marcus.id, sauce.id), "Unblocking restores what was shared");

const leakedBefore = coreRuleViolations(db);
check(leakedBefore.length === 0, `Core rule failed before the extra share: ${leakedBefore.join("; ")}`);

const kept = sharePost(db, {
  postId: market.id,
  fromUserId: marcus.id,
  recipients: [{ userId: alex.id, shareKind: "direct" }],
});
check(kept.rejected.length === 0, `Sharing the market photo should work: ${kept.rejected.map((item) => item.reason).join(" ")}`);
check(ids("alex").has(market.id), "After Marcus shares the market post with Alex, it is on Alex's timeline");
check(!ids("sam").has(market.id), "Sharing with Alex must not place the market post on Sam's timeline");
check(!ids("jordan").has(market.id), "Sharing with Alex must not place the market post on Jordan's timeline");
check(!ids("riley").has(market.id), "Passing the market photo to Alex does not put it on Riley's timeline");

const refused = sharePost(db, {
  postId: market.id,
  fromUserId: marcus.id,
  recipients: [{ userId: riley.id, shareKind: "direct" }],
});
check(refused.created.length === 0, "Riley refuses inbound shares, including from a friend");
check(!ids("riley").has(market.id), "A refused share must not land on the timeline");

const leakedAfter = coreRuleViolations(db);
check(leakedAfter.length === 0, `Core rule failed after sharing: ${leakedAfter.join("; ")}`);

const casey = getUserByUsername(db, "casey");
const quinn = getUserByUsername(db, "quinn");
const avery = getUserByUsername(db, "avery");
const morgan = getUserByUsername(db, "morgan");
const blake = getUserByUsername(db, "blake");
const rowan = getUserByUsername(db, "rowan");
const sage = getUserByUsername(db, "sage");
check(casey && quinn && avery && morgan && blake && rowan && sage, "one staff account per role");

function holds(person: { id: number }, permission: string, expected: boolean) {
  check(
    hasPermission(db, person.id, permission) === expected,
    `${permission} for user ${person.id} expected ${expected}`,
  );
}

holds(casey, "manage_support_tickets", true);
holds(casey, "review_reports", false);
holds(casey, "suspend_accounts", false);
holds(quinn, "review_reports", true);
holds(quinn, "moderate_content", true);
holds(quinn, "restrict_accounts", false);
holds(avery, "restrict_accounts", true);
holds(avery, "suspend_accounts", false);
holds(morgan, "suspend_accounts", true);
holds(morgan, "manage_platform_settings", false);
holds(blake, "manage_platform_settings", true);
holds(blake, "modify_roles", false);
holds(blake, "create_staff_accounts", false);
holds(rowan, "modify_roles", true);
holds(rowan, "modify_permissions", true);
holds(rowan, "access_emergency_controls", true);
holds(rowan, "platform_ownership", false);
holds(sage, "platform_ownership", true);
holds(sage, "access_emergency_controls", true);

check(!ROLE_TEMPLATES.administrator.includes("platform_ownership"), "Administrator template must not include ownership");
check(ROLE_TEMPLATES.founder.includes("platform_ownership"), "Founder template includes ownership");

const quinnQueues = queuesForPermissions(listPermissions(db, quinn.id));
check(quinnQueues.includes("moderator") && !quinnQueues.includes("manager"), "Moderator queue access stays at their grants");
check(!queuesForPermissions(listPermissions(db, casey.id)).length, "User Support has no report queue");
check(queuesForPermissions(listPermissions(db, sage.id)).includes("founder"), "Founder can open the ownership queue");
check(
  !queuesForPermissions(listPermissions(db, rowan.id)).includes("founder"),
  "Administrator does not open the founder queue",
);

db.prepare("DELETE FROM permissions WHERE user_id = ? AND permission = 'review_reports'").run(quinn.id);
check(getUserByUsername(db, "quinn")?.role === "moderator", "Role title remains after a grant is removed");
check(!hasPermission(db, quinn.id, "review_reports"), "A role title does not keep a removed permission");
check(!queuesForPermissions(listPermissions(db, quinn.id)).includes("moderator"), "Queue access follows the grant, not the title");

db.prepare(
  "INSERT INTO audit_log (staff_id, staff_role, action, reason, created_at) VALUES (?, 'moderator', 'probe', 'test', ?)",
).run(quinn.id, new Date().toISOString());
let deleteBlocked = false;
try {
  db.prepare("DELETE FROM audit_log").run();
} catch (error) {
  deleteBlocked = error instanceof Error && error.message.includes("audit history cannot be erased");
}
check(deleteBlocked, "Staff must not be able to erase audit history");

let updateBlocked = false;
try {
  db.prepare("UPDATE audit_log SET reason = 'rewritten'").run();
} catch (error) {
  updateBlocked = error instanceof Error && error.message.includes("audit history cannot be altered");
}
check(updateBlocked, "Audit history is append-only");

console.log("core rule ok");
console.log("Jordan has the river note. Alex and Sam do not.");
console.log("Marcus can pass Riley's market photo to Alex without Sam or Jordan receiving it.");
console.log("Mina's rooftop photo reached Marcus through Alex and Jordan, and nobody else.");
console.log("Administrator has no platform ownership. Founder does.");
console.log("Jordan's profile shows Marcus only what Jordan sent him. Noah's profile is open but empty for Marcus.");
console.log("Riley's hall reel can't be opened by Marcus by URL, media, or Reels.");
console.log("Comments and reactions on the river note are hidden from Alex.");
