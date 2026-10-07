"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import {
  acceptFriend,
  blockUser,
  createGroup,
  createList,
  createTicket,
  declineFriend,
  deleteGroup,
  deleteList,
  expandRecipients,
  getUserByUsername,
  markAllNotificationsRead,
  MEDIA_PLATES,
  publishPost,
  removeFriend,
  requestFriend,
  setAllowReshare,
  setDiscoverListing,
  sharePost,
  unblockUser,
  updatePrivacy,
  updateProfile,
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
import type { AddPolicy, ResharePolicy, SharePolicy, User } from "@/lib/types";

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

function shareSummary(created: number, rejected: { name: string; reason: string }[], discover: boolean) {
  const parts: string[] = [];
  if (created) {
    parts.push(`Placed on ${created} timeline${created === 1 ? "" : "s"}.`);
  }
  if (discover) parts.push("Listed on Discover. Discover does not fill anyone's timeline.");
  if (!created && discover) parts.push("It is not on your timeline.");
  if (rejected.length) {
    parts.push(`Not delivered: ${rejected.map((item) => `${item.name} — ${item.reason}`).join(" ")}`);
  }
  return parts.join(" ") || "Nothing was sent.";
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const user = getUserByUsername(getDb(), username);
  if (!user) redirect(withQuery("/", "error", "That person is not in this demo."));
  if (user.suspended) redirect(withQuery("/", "error", `${user.displayName} is suspended.`));
  const jar = await cookies();
  jar.set("line_session", user.username, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/timeline");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete("line_session");
  redirect("/");
}

export async function createPostAction(formData: FormData) {
  await run("/create", async (user) => {
    const kind = String(formData.get("kind") || "text");
    const plate = MEDIA_PLATES.find((item) => item.id === String(formData.get("plate") || ""));
    const listed = formData.get("discover") === "on";
    const result = publishPost(getDb(), user.id, {
      kind,
      body: String(formData.get("body") || ""),
      mediaLabel: plate?.label ?? null,
      mediaTone: plate?.tone ?? null,
      listedOnDiscover: listed,
      allowReshare: formData.get("allow_reshare") === "on",
      choice: choiceOf(formData),
      note: String(formData.get("note") || ""),
    });
    revalidatePath("/timeline");
    revalidatePath("/discover");
    revalidatePath("/posts");
    const extra = result.errors.length ? ` ${result.errors.join(" ")}` : "";
    redirect(withQuery("/timeline", "notice", `${shareSummary(result.created.length, result.rejected, listed)}${extra}`));
  });
}

export async function shareExistingAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  await run(`/share/${postId}`, async (user) => {
    const expanded = expandRecipients(getDb(), user.id, choiceOf(formData));
    if (!expanded.recipients.length) {
      throw new Error("Choose your timeline, a friend, a group, or a list.");
    }
    const result = sharePost(getDb(), {
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
    redirect(withQuery("/timeline", "notice", `${shareSummary(result.created.length, result.rejected, false)}${note}`));
  });
}

export async function requestFriendAction(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/friends");
  await run(returnTo, async (user) => {
    const person = requestFriend(getDb(), user.id, String(formData.get("username") || ""));
    revalidatePath("/friends");
    redirect(withQuery(returnTo, "notice", `Request sent to ${person.displayName}.`));
  });
}

export async function acceptFriendAction(formData: FormData) {
  await run("/friends", async (user) => {
    acceptFriend(getDb(), user.id, Number(formData.get("requestId")));
    revalidatePath("/friends");
    redirect(withQuery("/friends", "notice", "You are friends. They still cannot put something on your timeline unless they share it."));
  });
}

export async function declineFriendAction(formData: FormData) {
  await run("/friends", async (user) => {
    declineFriend(getDb(), user.id, Number(formData.get("requestId")));
    revalidatePath("/friends");
    redirect(withQuery("/friends", "notice", "Request closed."));
  });
}

export async function removeFriendAction(formData: FormData) {
  await run("/friends", async (user) => {
    removeFriend(getDb(), user.id, Number(formData.get("userId")));
    revalidatePath("/friends");
    redirect(withQuery("/friends", "notice", "Removed from your friends."));
  });
}

export async function blockAction(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/friends");
  await run(returnTo, async (user) => {
    blockUser(getDb(), user.id, Number(formData.get("userId")));
    revalidatePath("/friends");
    redirect(withQuery("/friends", "notice", "Blocked. They cannot share with you or add you."));
  });
}

export async function unblockAction(formData: FormData) {
  await run("/friends", async (user) => {
    unblockUser(getDb(), user.id, Number(formData.get("userId")));
    redirect(withQuery("/friends", "notice", "Block removed. Sharing still follows your share settings."));
  });
}

export async function createGroupAction(formData: FormData) {
  await run("/friends", async (user) => {
    createGroup(
      getDb(),
      user.id,
      String(formData.get("name") || ""),
      ids(formData, "member"),
      formData.get("allows_inbound") === "on",
    );
    redirect(withQuery("/friends", "notice", "Group saved. Use it when you share."));
  });
}

export async function deleteGroupAction(formData: FormData) {
  await run("/friends", async (user) => {
    deleteGroup(getDb(), user.id, Number(formData.get("groupId")));
    redirect(withQuery("/friends", "notice", "Group removed. Past shares stay where they were sent."));
  });
}

export async function createListAction(formData: FormData) {
  await run("/friends", async (user) => {
    createList(getDb(), user.id, String(formData.get("name") || ""), ids(formData, "member"));
    redirect(withQuery("/friends", "notice", "List saved for sharing."));
  });
}

export async function deleteListAction(formData: FormData) {
  await run("/friends", async (user) => {
    deleteList(getDb(), user.id, Number(formData.get("listId")));
    redirect(withQuery("/friends", "notice", "List removed."));
  });
}

export async function updateProfileAction(formData: FormData) {
  await run("/profile", async (user) => {
    updateProfile(getDb(), user.id, {
      displayName: String(formData.get("displayName") || ""),
      bio: String(formData.get("bio") || ""),
      avatarColor: String(formData.get("avatarColor") || user.avatarColor),
    });
    revalidatePath("/profile");
    redirect(withQuery("/profile", "notice", "Profile updated. Photo upload is a color avatar in this build."));
  });
}

export async function updatePrivacyAction(formData: FormData) {
  await run("/friends", async (user) => {
    const whoCanShare = String(formData.get("whoCanShare") || "friends") as SharePolicy;
    const whoCanAdd = String(formData.get("whoCanAdd") || "everyone") as AddPolicy;
    const whoCanReshare = String(formData.get("whoCanReshare") || "recipients") as ResharePolicy;
    updatePrivacy(getDb(), user.id, {
      whoCanShare,
      whoCanAdd,
      whoCanReshare,
      allowListIds: ids(formData, "allow"),
      inboundGroupIds: ids(formData, "inbound_group"),
    });
    redirect(withQuery("/friends", "notice", "Privacy saved. People outside those rules cannot put posts on your timeline."));
  });
}

export async function setDiscoverAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  await run(`/post/${postId}`, async (user) => {
    setDiscoverListing(getDb(), user.id, postId, formData.get("listed") === "1");
    revalidatePath("/discover");
    redirect(withQuery(`/post/${postId}`, "notice", formData.get("listed") === "1"
      ? "On Discover now. It still is not on anyone's timeline unless it was shared."
      : "Removed from Discover. Shares that already happened stay put."));
  });
}

export async function setReshareAction(formData: FormData) {
  const postId = Number(formData.get("postId"));
  await run(`/post/${postId}`, async (user) => {
    setAllowReshare(getDb(), user.id, postId, formData.get("allow") === "1");
    redirect(withQuery(`/post/${postId}`, "notice", "Reshare setting saved."));
  });
}

export async function reportAction(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/timeline");
  await run(returnTo, async (user) => {
    const id = createReport(getDb(), user.id, {
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
    createTicket(getDb(), user.id, String(formData.get("subject") || ""), String(formData.get("body") || ""));
    redirect(withQuery("/profile", "notice", "Sent to support. This is a short ticket, not a full help desk."));
  });
}

export async function markAllReadAction() {
  await run("/notifications", async (user) => {
    markAllNotificationsRead(getDb(), user.id);
    redirect("/notifications");
  });
}

export async function restrictAction(formData: FormData) {
  await run("/staff", async (user) => {
    restrictAccount(getDb(), user, Number(formData.get("userId")), formData.get("restricted") === "1", String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Account restriction updated. The audit log kept the reason."));
  });
}

export async function suspendAction(formData: FormData) {
  await run("/staff", async (user) => {
    suspendAccount(getDb(), user, Number(formData.get("userId")), formData.get("suspended") === "1", String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Suspension updated."));
  });
}

export async function hideAction(formData: FormData) {
  await run("/staff", async (user) => {
    hidePost(getDb(), user, Number(formData.get("postId")), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Post hidden. It leaves timelines and Discover. The share history remains."));
  });
}

export async function restoreAction(formData: FormData) {
  await run("/staff", async (user) => {
    restorePost(getDb(), user, Number(formData.get("postId")), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Post restored to the places it had actually been shared."));
  });
}

export async function escalateAction(formData: FormData) {
  await run("/staff", async (user) => {
    const toQueue = String(formData.get("toQueue") || "");
    escalateReport(
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
    resolveReport(getDb(), user, Number(formData.get("reportId")), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Case resolved."));
  });
}

export async function ticketStatusAction(formData: FormData) {
  await run("/staff", async (user) => {
    updateTicket(getDb(), user, Number(formData.get("ticketId")), String(formData.get("status") || ""), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Ticket updated. This list is not a full CRM."));
  });
}

export async function settingAction(formData: FormData) {
  await run("/staff", async (user) => {
    updateSetting(getDb(), user, String(formData.get("key") || ""), String(formData.get("value") || ""), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Setting saved and written to the audit log."));
  });
}

export async function createStaffAction(formData: FormData) {
  await run("/staff", async (user) => {
    const selected = formData.getAll("permission").map(String).filter((value) => (PERMISSIONS as readonly string[]).includes(value));
    createStaffAccount(getDb(), user, {
      username: String(formData.get("username") || ""),
      displayName: String(formData.get("displayName") || ""),
      role: String(formData.get("role") || ""),
      permissions: selected,
      reason: String(formData.get("reason") || ""),
    });
    redirect(withQuery("/staff", "notice", "Staff account created from the checked permissions, not from the role title alone."));
  });
}

export async function roleAction(formData: FormData) {
  await run("/staff", async (user) => {
    modifyRole(getDb(), user, Number(formData.get("userId")), String(formData.get("role") || ""), String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Role label changed. Permissions were not implied by the new title."));
  });
}

export async function permissionsAction(formData: FormData) {
  await run("/staff", async (user) => {
    const selected = formData.getAll("permission").map(String);
    modifyPermissions(getDb(), user, Number(formData.get("userId")), selected, String(formData.get("reason") || ""));
    redirect(withQuery("/staff", "notice", "Permission grants replaced."));
  });
}
