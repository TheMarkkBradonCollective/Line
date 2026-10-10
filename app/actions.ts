"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanUsername, ensureProfile, getCurrentUser } from "@/lib/session";
import { confirmUploads, createUploadTargets, type UploadRequest, type UploadTarget } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";
import {
  acceptFriend,
  addComment,
  blockUser,
  createGroup,
  createList,
  createTicket,
  declineFriend,
  deleteGroup,
  deleteList,
  canViewPost,
  expandRecipients,
  getPost,
  getSetting,
  getUserById,
  getUserByUsername,
  markAllNotificationsRead,
  publishPost,
  removeFriend,
  requestFriend,
  REACTION_KINDS,
  setAllowReshare,
  setReaction,
  sharePost,
  shareTargets,
  unblockUser,
  updatePrivacy,
  updateProfile,
  type ReactionKind,
  type RecipientChoice,
} from "@/lib/social";
import {
  createReport,
  createStaffAccount,
  escalateReport,
  hidePost,
  modifyPermissions,
  modifyRole,
  resolveReport,
  restorePost,
  restrictAccount,
  suspendAccount,
  updateSetting,
  updateTicket,
} from "@/lib/staff";
import type { AddPolicy, Frame, ResharePolicy, SharePolicy, User } from "@/lib/types";

function withQuery(path: string, key: string, value: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${base}?${params.toString()}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}

const FRIEND_TABS = new Set(["friends", "requests", "groups", "privacy"]);

/** Send Friends actions back to the tab they came from. */
function friendsPath(formData: FormData) {
  const tab = String(formData.get("tab") || "");
  return FRIEND_TABS.has(tab) && tab !== "friends" ? `/friends?tab=${tab}` : "/friends";
}

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

async function run(returnPath: string, fn: (user: User) => void | Promise<void>) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.suspended) redirect(withQuery("/", "error", "This account is suspended."));
  try {
    await fn(user);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : "Something went wrong.";
    redirect(withQuery(returnPath, "error", message));
  }
}

function ids(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function choiceOf(formData: FormData): RecipientChoice {
  return {
    self: formData.get("self") === "on",
    friendIds: ids(formData, "friend"),
    groupIds: ids(formData, "group"),
    listIds: ids(formData, "list"),
  };
}

function shareSummary(created: number, rejected: { name: string; reason: string }[]) {
  const parts: string[] = [];
  if (created) {
    parts.push(`Placed on ${created} timeline${created === 1 ? "" : "s"}.`);
  }
  if (rejected.length) {
    parts.push(`Not delivered: ${rejected.map((item) => `${item.name} — ${item.reason}`).join(" ")}`);
  }
  return parts.join(" ") || "Nothing was sent.";
}

function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don’t match.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first. Check your inbox for the link.";
  if (/already registered|already been registered/i.test(message)) return "That email already has an account. Sign in instead.";
  if (/rate limit/i.test(message)) return "Too many tries. Wait a minute and try again.";
  return message;
}

async function siteOrigin() {
  const jar = await headers();
  const fromRequest = jar.get("origin") || (jar.get("host") ? `${jar.get("x-forwarded-proto") ?? "https"}://${jar.get("host")}` : "");
  return (process.env.NEXT_PUBLIC_SITE_URL || fromRequest || "http://localhost:43921").replace(/\/$/, "");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect(withQuery("/", "error", "Enter your email and password."));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(withQuery("/", "error", authMessage(error?.message ?? "Could not sign in.")));
  const profile = await ensureProfile(getDb(), { id: data.user.id, email: data.user.email ?? null, meta: data.user.user_metadata ?? {} });
  if (profile.suspended) {
    await supabase.auth.signOut();
    redirect(withQuery("/", "error", "This account is suspended."));
  }
  redirect("/timeline");
}

export async function signUpAction(formData: FormData) {
  const back = (message: string) => redirect(withQuery("/?mode=signup", "error", message));
  const db = getDb();
  if ((await getSetting(db, "signups_open")) === "0") back("Sign-ups are closed right now.");
  const displayName = String(formData.get("displayName") || "").trim().slice(0, 80);
  const username = cleanUsername(String(formData.get("username") || ""));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (displayName.length < 2) back("Add the name people know you by.");
  if (username.length < 3) back("Pick a username of at least 3 letters or numbers.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("Enter a valid email address.");
  if (password.length < 8) back("Use a password of at least 8 characters.");
  if (await getUserByUsername(db, username)) back("That username is taken.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName }, emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error) back(authMessage(error.message));
  if (data.session && data.user) {
    await ensureProfile(db, { id: data.user.id, email, meta: { username, display_name: displayName } });
    redirect(withQuery("/timeline", "notice", "Welcome to LINE. Add friends, then share something with them."));
  }
  redirect(withQuery("/", "notice", "Check your email for a confirmation link, then sign in."));
}

export async function logoutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

/** One-time signed upload URLs for Create. Files land in the author's own folder of the private bucket. */
export async function prepareUploadsAction(
  kind: string,
  files: UploadRequest[],
): Promise<{ targets: UploadTarget[] } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || user.suspended || user.restricted) return { error: "Your account cannot upload right now." };
  try {
    const list = (Array.isArray(files) ? files : []).map((file) => ({ type: String(file?.type ?? ""), size: Number(file?.size ?? 0) }));
    return { targets: await createUploadTargets(user.id, String(kind), list) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Uploads are unavailable right now." };
  }
}

function uploadsOf(formData: FormData): Frame[] {
  const frames: Frame[] = [];
  for (const value of formData.getAll("upload")) {
    try {
      const parsed = JSON.parse(String(value)) as { path?: unknown; mime?: unknown };
      if (typeof parsed.path === "string" && typeof parsed.mime === "string") frames.push({ path: parsed.path, mime: parsed.mime });
    } catch {
      // ignore malformed entries
    }
  }
  return frames;
}

export async function createPostAction(formData: FormData) {
  await run("/create", async (user) => {
    const kind = String(formData.get("kind") || "text");
    const uploads = kind === "text" ? [] : await confirmUploads(user.id, uploadsOf(formData));
    const result = await publishPost(getDb(), user.id, {
      kind,
      body: String(formData.get("body") || ""),
      frames: uploads,
      allowReshare: formData.get("allow_reshare") === "on",
      choice: choiceOf(formData),
      note: String(formData.get("note") || ""),
    });
    revalidatePath("/timeline");
    revalidatePath("/posts");
    const extra = result.errors.length ? ` ${result.errors.join(" ")}` : "";
    redirect(withQuery("/timeline", "notice", `${shareSummary(result.created.length, result.rejected)}${extra}`));
  });
}

export async function shareExistingAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  await run(`/share/${postId}`, async (user) => {
    const expanded = await expandRecipients(getDb(), user.id, choiceOf(formData));
    if (!expanded.recipients.length) {
      throw new Error("Choose your timeline, a friend, a group, or a list.");
    }
    const result = await sharePost(getDb(), {
      postId,
      fromUserId: user.id,
      recipients: expanded.recipients,
      note: String(formData.get("note") || ""),
    });
    if (!result.created.length) {
      throw new Error(result.rejected.map((item) => `${item.name} — ${item.reason}`).join(" ") || "Nothing was shared.");
    }
    revalidatePath("/timeline");
    revalidatePath("/notifications");
    const note = expanded.errors.length ? ` ${expanded.errors.join(" ")}` : "";
    redirect(withQuery("/timeline", "notice", `${shareSummary(result.created.length, result.rejected)}${note}`));
  });
}

export type SheetPost = {
  id: number;
  kind: string;
  body: string;
  /** First file, for the sheet's thumbnail. Loaded through the gated media route. */
  cover: Frame | null;
  authorName: string;
};

/** Data for the share sheet. Read-only. */
export async function shareSheetAction(postId: number) {
  const user = await getCurrentUser();
  if (!user || user.suspended) throw new Error("Sign in to share.");
  const db = getDb();
  const post = await getPost(db, Number(postId));
  if (!post || !await canViewPost(db, user, post) || post.hidden) throw new Error("That post is not available to share.");
  const author = await getUserById(db, post.authorId);
  const targets = await shareTargets(db, user, post);
  const sheetPost: SheetPost = {
    id: post.id,
    kind: post.kind,
    body: post.body,
    cover: post.frames[0] ?? null,
    authorName: author?.displayName ?? "Someone",
  };
  return { post: sheetPost, restricted: Boolean(user.restricted), paused: await getSetting(db, "sharing_paused") === "1", ...targets };
}

export type SheetResult = {
  ok: boolean;
  delivered: { userId: number; name: string; initials: string; color: string }[];
  rejected: { name: string; reason: string }[];
  message: string;
};

/** Share from the sheet. Same rules as shareExistingAction, but it answers instead of redirecting. */
export async function shareFromSheetAction(input: {
  postId: number;
  self: boolean;
  friendIds: number[];
  groupIds: number[];
  listIds: number[];
  note: string;
}): Promise<SheetResult> {
  const user = await getCurrentUser();
  if (!user || user.suspended) return { ok: false, delivered: [], rejected: [], message: "Sign in to share." };
  const db = getDb();
  const clean = (values: unknown) =>
    (Array.isArray(values) ? values : []).map(Number).filter((value) => Number.isInteger(value) && value > 0);
  const expanded = await expandRecipients(db, user.id, {
    self: Boolean(input.self),
    friendIds: clean(input.friendIds),
    groupIds: clean(input.groupIds),
    listIds: clean(input.listIds),
  });
  if (!expanded.recipients.length) {
    return { ok: false, delivered: [], rejected: [], message: "Pick your timeline, a friend, a group, or a list." };
  }
  try {
    const result = await sharePost(db, {
      postId: Number(input.postId),
      fromUserId: user.id,
      recipients: expanded.recipients,
      note: String(input.note || ""),
    });
    revalidatePath("/timeline");
    revalidatePath("/notifications");
    const delivered = await Promise.all(result.created.map(async (item) => {
      const person = await getUserById(db, item.userId);
      return {
        userId: item.userId,
        name: item.userId === user.id ? "Your timeline" : (person?.displayName ?? "Someone"),
        initials: person?.initials ?? "?",
        color: person?.avatarColor ?? "#00bf8f",
      };
    }));
    const extra = expanded.errors.map((reason) => ({ name: "Note", reason }));
    return {
      ok: delivered.length > 0,
      delivered,
      rejected: [...result.rejected.map((item) => ({ name: item.name, reason: item.reason })), ...extra],
      message: shareSummary(result.created.length, result.rejected),
    };
  } catch (error) {
    return { ok: false, delivered: [], rejected: [], message: error instanceof Error ? error.message : "Nothing was shared." };
  }
}

export async function requestFriendAction(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/friends");
  await run(returnTo, async (user) => {
    const person = await requestFriend(getDb(), user.id, String(formData.get("username") || ""));
    revalidatePath("/friends");
    redirect(withQuery(returnTo, "notice", `Request sent to ${person.displayName}.`));
  });
}

export async function acceptFriendAction(formData: FormData) {
  await run("/friends", async (user) => {
    await acceptFriend(getDb(), user.id, Number(formData.get("requestId")));
    revalidatePath("/friends");
    redirect(withQuery(friendsPath(formData), "notice", "You are friends. They still cannot put something on your timeline unless they share it."));
  });
}

export async function declineFriendAction(formData: FormData) {
  await run("/friends", async (user) => {
    await declineFriend(getDb(), user.id, Number(formData.get("requestId")));
    revalidatePath("/friends");
    redirect(withQuery(friendsPath(formData), "notice", "Request closed."));
  });
}

export async function removeFriendAction(formData: FormData) {
  await run("/friends", async (user) => {
    await removeFriend(getDb(), user.id, Number(formData.get("userId")));
    revalidatePath("/friends");
    redirect(withQuery(friendsPath(formData), "notice", "Removed from your friends."));
  });
}

export async function blockAction(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/friends");
  await run(returnTo, async (user) => {
    await blockUser(getDb(), user.id, Number(formData.get("userId")));
    revalidatePath("/friends");
    redirect(withQuery(friendsPath(formData), "notice", "Blocked. They cannot share with you or add you."));
  });
}

export async function unblockAction(formData: FormData) {
  await run("/friends", async (user) => {
    await unblockUser(getDb(), user.id, Number(formData.get("userId")));
    redirect(withQuery(friendsPath(formData), "notice", "Block removed. Sharing still follows your share settings."));
  });
}

export async function createGroupAction(formData: FormData) {
  await run("/friends", async (user) => {
    await createGroup(
      getDb(),
      user.id,
      String(formData.get("name") || ""),
      ids(formData, "member"),
      formData.get("allows_inbound") === "on",
    );
    redirect(withQuery(friendsPath(formData), "notice", "Group saved. Use it when you share."));
  });
}

export async function deleteGroupAction(formData: FormData) {
  await run("/friends", async (user) => {
    await deleteGroup(getDb(), user.id, Number(formData.get("groupId")));
    redirect(withQuery(friendsPath(formData), "notice", "Group removed. Past shares stay where they were sent."));
  });
}

export async function createListAction(formData: FormData) {
  await run("/friends", async (user) => {
    await createList(getDb(), user.id, String(formData.get("name") || ""), ids(formData, "member"));
    redirect(withQuery(friendsPath(formData), "notice", "List saved for sharing."));
  });
}

export async function deleteListAction(formData: FormData) {
  await run("/friends", async (user) => {
    await deleteList(getDb(), user.id, Number(formData.get("listId")));
    redirect(withQuery(friendsPath(formData), "notice", "List removed."));
  });
}

export async function updateProfileAction(formData: FormData) {
  await run("/profile", async (user) => {
    await updateProfile(getDb(), user.id, {
      displayName: String(formData.get("displayName") || ""),
      bio: String(formData.get("bio") || ""),
      avatarColor: String(formData.get("avatarColor") || user.avatarColor),
      location: String(formData.get("location") ?? ""),
      work: String(formData.get("work") ?? ""),
      education: String(formData.get("education") ?? ""),
    });
    revalidatePath("/profile");
    redirect(withQuery("/profile", "notice", "Profile updated."));
  });
}

export async function updatePrivacyAction(formData: FormData) {
  await run("/friends", async (user) => {
    const whoCanShare = String(formData.get("whoCanShare") || "friends") as SharePolicy;
    const whoCanAdd = String(formData.get("whoCanAdd") || "everyone") as AddPolicy;
    const whoCanReshare = String(formData.get("whoCanReshare") || "recipients") as ResharePolicy;
    await updatePrivacy(getDb(), user.id, {
      whoCanShare,
      whoCanAdd,
      whoCanReshare,
      allowListIds: ids(formData, "allow"),
      inboundGroupIds: ids(formData, "inbound_group"),
    });
    redirect(withQuery(friendsPath(formData), "notice", "Privacy saved. People outside those rules cannot put posts on your timeline."));
  });
}

/** Set or clear your reaction. The access check lives in setReaction, not here. */
export async function reactAction(postId: number, kind: ReactionKind | null) {
  const user = await getCurrentUser();
  if (!user || user.suspended) throw new Error("Sign in to react.");
  if (kind !== null && !REACTION_KINDS.includes(kind)) throw new Error("Pick a reaction.");
  const next = await setReaction(getDb(), user.id, Number(postId), kind);
  return next.reactions;
}

export async function addCommentAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  const parentId = Number(formData.get("parentId")) || null;
  await run(`/post/${postId}`, async (user) => {
    const id = await addComment(getDb(), user.id, postId, { body: String(formData.get("body") || ""), parentId });
    revalidatePath(`/post/${postId}`);
    redirect(`/post/${postId}#c-${id}`);
  });
}

export async function setReshareAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  await run(`/post/${postId}`, async (user) => {
    await setAllowReshare(getDb(), user.id, postId, formData.get("allow") === "1");
    redirect(withQuery(`/post/${postId}`, "notice", "Reshare setting saved."));
  });
}

export async function reportAction(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/timeline");
  await run(returnTo, async (user) => {
    const id = await createReport(getDb(), user.id, {
      targetType: String(formData.get("targetType") || ""),
      targetId: Number(formData.get("targetId")),
      category: String(formData.get("category") || ""),
      details: String(formData.get("details") || ""),
    });
    redirect(withQuery(returnTo, "notice", `Report #${id} is in the moderator queue. It is not a timeline post.`));
  });
}

export async function ticketAction(formData: FormData) {
  await run("/profile", async (user) => {
    await createTicket(getDb(), user.id, String(formData.get("subject") || ""), String(formData.get("body") || ""));
    redirect(withQuery("/profile", "notice", "Sent to support. This is a short ticket, not a full help desk."));
  });
}

export async function markAllReadAction() {
  await run("/notifications", async (user) => {
    await markAllNotificationsRead(getDb(), user.id);
    redirect("/notifications");
  });
}

export async function restrictAction(formData: FormData) {
  await run("/staff", async (user) => {
    await restrictAccount(getDb(), user, Number(formData.get("userId")), formData.get("restricted") === "1", String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Account restriction updated. The audit log kept the reason."));
  });
}

export async function suspendAction(formData: FormData) {
  await run("/staff", async (user) => {
    await suspendAccount(getDb(), user, Number(formData.get("userId")), formData.get("suspended") === "1", String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Suspension updated."));
  });
}

export async function hideAction(formData: FormData) {
  await run("/staff", async (user) => {
    await hidePost(getDb(), user, Number(formData.get("postId")), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Post hidden. It leaves timelines. The share history remains."));
  });
}

export async function restoreAction(formData: FormData) {
  await run("/staff", async (user) => {
    await restorePost(getDb(), user, Number(formData.get("postId")), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Post restored to the places it had actually been shared."));
  });
}

export async function escalateAction(formData: FormData) {
  await run("/staff", async (user) => {
    const toQueue = String(formData.get("toQueue") || "");
    await escalateReport(
      getDb(),
      user,
      Number(formData.get("reportId")),
      String(formData.get("reason") || ""),
      toQueue ? (toQueue as "administrator" | "founder") : undefined,
    );
    redirect(withQuery("/staff", "notice", "Case escalated."));
  });
}

export async function resolveAction(formData: FormData) {
  await run("/staff", async (user) => {
    await resolveReport(getDb(), user, Number(formData.get("reportId")), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Case resolved."));
  });
}

export async function ticketStatusAction(formData: FormData) {
  await run("/staff", async (user) => {
    await updateTicket(getDb(), user, Number(formData.get("ticketId")), String(formData.get("status") || ""), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Ticket updated. This list is not a full CRM."));
  });
}

export async function settingAction(formData: FormData) {
  await run("/staff", async (user) => {
    await updateSetting(getDb(), user, String(formData.get("key") || ""), String(formData.get("value") || ""), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Setting saved and written to the audit log."));
  });
}

export async function createStaffAction(formData: FormData) {
  await run("/staff", async (user) => {
    const selected = formData.getAll("permission").map(String).filter((value) => (PERMISSIONS as readonly string[]).includes(value));
    await createStaffAccount(getDb(), user, {
      username: String(formData.get("username") || ""),
      displayName: String(formData.get("displayName") || ""),
      role: String(formData.get("role") || ""),
      permissions: selected,
      reason: String(formData.get("reason") || ""),
    });
    redirect(withQuery("/staff", "notice", "Staff seat granted from the checked permissions, not from the role title alone."));
  });
}

export async function roleAction(formData: FormData) {
  await run("/staff", async (user) => {
    await modifyRole(getDb(), user, Number(formData.get("userId")), String(formData.get("role") || ""), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Role label changed. Permissions were not implied by the new title."));
  });
}

export async function permissionsAction(formData: FormData) {
  await run("/staff", async (user) => {
    const selected = formData.getAll("permission").map(String);
    await modifyPermissions(getDb(), user, Number(formData.get("userId")), selected, String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Permission grants replaced."));
  });
}
