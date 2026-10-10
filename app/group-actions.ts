"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { ids, run, safePath, withQuery } from "@/lib/action-kit";
import { removeProfileImage, uploadProfileImage } from "@/lib/storage";
import { addComment } from "@/lib/social";
import {
  addGroupMember,
  createCommunity,
  deleteCommunity,
  leaveGroup,
  removeGroupMember,
  removeGroupPost,
  renameGroup,
  setGroupMuted,
  setGroupPhoto,
  setGroupRole,
} from "@/lib/groups";

export async function createGroupAction(formData: FormData) {
  await run("/groups", async (user) => {
    const id = await createCommunity(getDb(), user.id, {
      name: String(formData.get("name") || ""),
      about: String(formData.get("about") || ""),
      memberIds: ids(formData, "member"),
    });
    revalidatePath("/groups");
    redirect(withQuery(`/groups/${id}`, "notice", "Group created."));
  });
}

export async function addGroupMemberAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const back = `/groups/${groupId}/members`;
  await run(back, async (user) => {
    for (const id of ids(formData, "member")) await addGroupMember(getDb(), user.id, groupId, id);
    revalidatePath(back);
    redirect(withQuery(back, "notice", "Added."));
  });
}

export async function removeGroupMemberAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const back = `/groups/${groupId}/members`;
  await run(back, async (user) => {
    await removeGroupMember(getDb(), user.id, groupId, Number(formData.get("userId")));
    revalidatePath(back);
    redirect(withQuery(back, "notice", "Removed from the group."));
  });
}

export async function setGroupRoleAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const back = `/groups/${groupId}/members`;
  await run(back, async (user) => {
    await setGroupRole(getDb(), user.id, groupId, Number(formData.get("userId")), formData.get("role") === "admin" ? "admin" : "member");
    revalidatePath(back);
    redirect(withQuery(back, "notice", "Role updated."));
  });
}

export async function updateGroupAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const back = `/groups/${groupId}/settings`;
  await run(back, async (user) => {
    const db = getDb();
    await renameGroup(db, user.id, groupId, String(formData.get("name") || ""), String(formData.get("about") || ""));
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const path = await uploadProfileImage(user.id, "avatar", photo);
      const old = await setGroupPhoto(db, user.id, groupId, path);
      await removeProfileImage(old);
    } else if (formData.get("removePhoto") === "on") {
      const old = await setGroupPhoto(db, user.id, groupId, null);
      await removeProfileImage(old);
    }
    revalidatePath(`/groups/${groupId}`);
    redirect(withQuery(back, "notice", "Saved."));
  });
}

export async function leaveGroupAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  await run(`/groups/${groupId}`, async (user) => {
    await leaveGroup(getDb(), user.id, groupId);
    revalidatePath("/groups");
    redirect(withQuery("/groups", "notice", "You left the group."));
  });
}

export async function deleteGroupAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  await run(`/groups/${groupId}/settings`, async (user) => {
    if (formData.get("confirm") !== "DELETE") throw new Error("Type DELETE to confirm.");
    const old = await deleteCommunity(getDb(), user.id, groupId);
    await removeProfileImage(old);
    revalidatePath("/groups");
    redirect(withQuery("/groups", "notice", "Group deleted."));
  });
}

export async function muteGroupAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const back = safePath(formData.get("returnTo"), `/groups/${groupId}`);
  await run(back, async (user) => {
    const muted = formData.get("muted") === "1";
    await setGroupMuted(getDb(), user.id, groupId, muted);
    revalidatePath(back);
    redirect(withQuery(back, "notice", muted ? "Group muted. You won’t get alerts for new posts." : "Group unmuted."));
  });
}

export async function removeGroupPostAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  await run(`/groups/${groupId}`, async (user) => {
    await removeGroupPost(getDb(), user.id, groupId, Number(formData.get("postId")));
    revalidatePath(`/groups/${groupId}`);
    redirect(withQuery(`/groups/${groupId}`, "notice", "Removed from the group."));
  });
}

export async function addGroupCommentAction(formData: FormData) {
  const groupId = Number(formData.get("groupId"));
  const postId = Number(formData.get("postId"));
  const back = `/groups/${groupId}/post/${postId}`;
  await run(back, async (user) => {
    const id = await addComment(getDb(), user.id, postId, {
      body: String(formData.get("body") || ""),
      parentId: Number(formData.get("parentId")) || null,
      groupId,
    });
    revalidatePath(back);
    redirect(`${back}#c-${id}`);
  });
}
