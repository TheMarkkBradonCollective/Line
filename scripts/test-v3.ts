import type { Db } from "../lib/db";
import { withTestDatabase } from "./lib/test-db";
import { canViewPost } from "../lib/access";
import { addComment, listComments, listNotifications, publishPost, sharePost, setAllowReshare } from "../lib/social";
import {
  addGroupMember,
  canUseGroupThread,
  createCommunity,
  deleteCommunity,
  getCommunity,
  groupFeed,
  leaveGroup,
  removeGroupMember,
  shareToGroup,
} from "../lib/groups";

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export async function threw(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}
export function people(db: Db) {
  return {
    async person(username: string) {
      return db.insert("INSERT INTO profiles (username, display_name, avatar_color, initials) VALUES (?, ?, '#00bf8f', ?)", [
        username,
        username[0].toUpperCase() + username.slice(1),
        username.slice(0, 2).toUpperCase(),
      ]);
    },
    async befriend(a: number, b: number) {
      await db.run("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')", [a, b]);
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 15));
const justMe = { self: true, friendIds: [], groupIds: [], listIds: [] };

export async function groupRules(db: Db) {
  const { person, befriend } = people(db);
  const owner = await person("gina");
  const amy = await person("amy");
  const bo = await person("bo");
  const cy = await person("cy"); // joins later
  const dee = await person("dee"); // Bo's friend outside the group
  const zed = await person("zed"); // stranger
  await befriend(owner, amy);
  await befriend(owner, bo);
  await befriend(owner, cy);
  await befriend(bo, dee);

  check(await threw(() => createCommunity(db, owner, { name: "Crew", memberIds: [zed] })), "Only friends can be added to a group");
  const gid = await createCommunity(db, owner, { name: "Crew", memberIds: [amy, bo] });
  check((await getCommunity(db, owner, gid))?.role === "owner", "Creator is the owner");
  check((await getCommunity(db, zed, gid)) === null, "Non-members can't open a group");
  check((await groupFeed(db, zed, gid)) === null, "Non-members get no group feed");

  // Amy posts directly into the group (just-me post, then into the group).
  await tick();
  const p = await publishPost(db, amy, { kind: "text", body: "group hello", allowReshare: true, choice: { ...justMe, self: false, communityIds: [gid] } });
  await shareToGroup(db, amy, gid, p.postId);
  check(await canViewPost(db, bo, p.postId), "Members see a post shared into their group");
  check(!(await canViewPost(db, zed, p.postId)), "Non-members don't see group posts");
  check(!(await canViewPost(db, dee, p.postId)), "A member's outside friend doesn't see group posts");
  check((await groupFeed(db, bo, gid))!.some((i) => i.post.id === p.postId), "Group feed shows posts shared to the group");

  // Group thread.
  const c1 = await addComment(db, bo, p.postId, { body: "in the group", groupId: gid });
  check((await listComments(db, owner, p.postId, { groupId: gid }))!.some((c) => c.id === c1), "Members read the group thread");
  check((await listComments(db, zed, p.postId, { groupId: gid })) === null, "Non-members can't read the group thread");
  check((await listComments(db, bo, p.postId))!.length === 0, "Group-only viewers don't get the post's other comments");
  check(await threw(() => addComment(db, bo, p.postId, { body: "outside" })), "Group-only viewers can't comment outside the group thread");
  check((await listComments(db, amy, p.postId))!.every((c) => c.id !== c1), "The author's normal thread doesn't contain group comments");
  check((await listNotifications(db, amy)).some((n) => n.kind === "commented" && n.group_id === gid), "Author is told about group comments (as a member)");

  // Late joiner.
  await tick();
  await addGroupMember(db, owner, gid, cy);
  check(!(await canViewPost(db, cy, p.postId)), "A member who joins later doesn't see older group posts");
  check(!(await canUseGroupThread(db, cy, gid, p.postId)), "A late joiner can't use older group threads");
  check(!(await groupFeed(db, cy, gid))!.some((i) => i.post.id === p.postId), "Late joiner's group feed starts at their join");
  await tick();
  const p2 = await publishPost(db, owner, { kind: "text", body: "after cy", allowReshare: true, choice: justMe });
  await shareToGroup(db, owner, gid, p2.postId);
  check(await canViewPost(db, cy, p2.postId), "A late joiner sees posts shared after they joined");
  check(await threw(() => addGroupMember(db, bo, gid, dee)), "Regular members can't add people");

  // Reshare onward to own friend: Home share, no group thread.
  const re = await sharePost(db, { postId: p.postId, fromUserId: bo, recipients: [{ userId: dee, shareKind: "direct" }] });
  check(re.created.length === 1 && (await canViewPost(db, dee, p.postId)), "A member can pass a group post on to their own friend");
  check((await listComments(db, dee, p.postId))!.every((c) => c.id !== c1), "The onward share doesn't carry the group thread");
  check((await listComments(db, dee, p.postId, { groupId: gid })) === null, "The onward recipient can't open the group thread");
  check((await sharePost(db, { postId: p.postId, fromUserId: bo, recipients: [{ userId: zed, shareKind: "direct" }] })).created.length === 0, "Onward shares from a group still go to friends only");
  await setAllowReshare(db, owner, p2.postId, false);
  check((await sharePost(db, { postId: p2.postId, fromUserId: bo, recipients: [{ userId: dee, shareKind: "direct" }] })).created.length === 0, "Resharing off blocks passing a group post on");
  const gid2 = await createCommunity(db, bo, { name: "Other", memberIds: [dee] });
  check(await threw(() => shareToGroup(db, bo, gid2, p2.postId)), "Resharing off blocks sharing it into another group");
  check(await threw(() => shareToGroup(db, zed, gid, p2.postId)), "Non-members can't share into a group");

  // Leaving.
  await leaveGroup(db, amy, gid);
  check(await canViewPost(db, amy, p.postId), "The author still sees her own post after leaving");
  check(!(await canUseGroupThread(db, amy, gid, p.postId)), "A member who leaves loses the group thread");
  check(!(await listNotifications(db, amy)).some((n) => n.group_id === gid), "Group alerts disappear after leaving");
  await removeGroupMember(db, owner, gid, bo);
  check(await canViewPost(db, bo, p.postId) === false, "A removed member loses access that came through the group");
  check(await canViewPost(db, dee, p.postId), "People it was passed on to keep their own share");

  // Owner leaving hands over; deleting removes group threads.
  await addGroupMember(db, owner, gid, amy);
  await leaveGroup(db, owner, gid);
  const after = await getCommunity(db, cy, gid);
  check(after && after.members.some((m) => m.role === "owner"), "When the owner leaves, someone else becomes owner");
  const newOwner = after!.members.find((m) => m.role === "owner")!.user.id;
  await deleteCommunity(db, newOwner, gid);
  check(!(await canViewPost(db, cy, p2.postId)), "Deleting the group ends access through it");
  console.log("groups ok: members-only feeds and threads, late joiners, leaving, onward shares, admin roles.");
}

/** The site must keep working before the owner runs line_update3.sql: every pre-update code path still runs. */
async function beforeUpdate(db: Db) {
  const { resetSchemaReady } = await import("../lib/schema-ready");
  const social = await import("../lib/social");
  await db.exec("DROP TABLE line_v3_marker");
  resetSchemaReady();
  const { person, befriend } = people(db);
  const a = await person("preupa");
  const b = await person("preupb");
  await befriend(a, b);
  const p = await publishPost(db, a, { kind: "text", body: "before update", allowReshare: true, choice: { self: true, friendIds: [b], groupIds: [], listIds: [] } });
  check(await canViewPost(db, b, p.postId), "Before the update, shares still work");
  await addComment(db, b, p.postId, { body: "hi" });
  check((await listComments(db, a, p.postId))!.length === 1, "Before the update, comments still work");
  check((await listNotifications(db, a)).length > 0, "Before the update, alerts still work");
  await social.getHomeFeed(db, b);
  await social.getDiscover(db, b);
  await social.listReels(db, b);
  await social.profilePosts(db, b, a, "posts");
  const more = await import("./test-v3-more");
  if (more.beforeUpdate) await more.beforeUpdate(db, { a, b, postId: p.postId });
  console.log("pre-update fallback ok: the site works before line_update3.sql runs.");
}

if (process.argv[1]?.endsWith("test-v3.ts")) {
  withTestDatabase(async (db) => {
    await groupRules(db);
    const extra = await import("./test-v3-more");
    await extra.run(db);
    await beforeUpdate(db);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
