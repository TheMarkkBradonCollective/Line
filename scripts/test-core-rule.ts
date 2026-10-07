import fs from "fs";
import os from "os";
import path from "path";
import { createDatabase } from "../lib/db";
import { queuesForPermissions, ROLE_TEMPLATES } from "../lib/permissions";
import { seed } from "../lib/seed";
import {
  coreRuleViolations,
  getPostBySeedKey,
  getTimeline,
  getUserByUsername,
  hasPermission,
  listPermissions,
  sharePost,
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
