export type SharePolicy = "friends" | "groups" | "nobody" | "allow_list";
export type AddPolicy = "everyone" | "friends_of_friends" | "nobody";
export type ResharePolicy = "recipients" | "friends" | "nobody";

export type User = {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  initials: string;
  role: string;
  whoCanShare: SharePolicy;
  whoCanAdd: AddPolicy;
  whoCanReshare: ResharePolicy;
  location: string;
  work: string;
  education: string;
  restricted: number;
  suspended: number;
  createdAt: string;
  /** Public profile photo / cover URLs, or null for initials and the green cover. */
  avatarUrl: string | null;
  coverUrl: string | null;
};

/** short and long_video are older names. New posts are text, photo, video, or reel. */
export type PostKind = "text" | "photo" | "video" | "short" | "long_video" | "reel";

/** One uploaded file in the private line-media bucket. */
export type Frame = { path: string; mime: string };

export function isVideoFrame(frame: Frame) {
  return frame.mime.startsWith("video/");
}

export type Post = {
  id: number;
  authorId: number;
  kind: PostKind;
  body: string;
  /** Every uploaded file of the post. Photo posts can have several; video and reels have one. Text posts have none. */
  frames: Frame[];
  allowReshare: number;
  hidden: number;
  hiddenReason: string | null;
  seedKey: string | null;
  createdAt: string;
};

export type UserRow = {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  avatar_color: string;
  initials: string;
  avatar_path?: string | null;
  cover_path?: string | null;
  role: string;
  who_can_share: SharePolicy;
  who_can_add: AddPolicy;
  who_can_reshare: ResharePolicy;
  location?: string;
  work?: string;
  education?: string;
  restricted: number;
  suspended: number;
  created_at: string;
};

export type PostRow = {
  id: number;
  author_id: number;
  kind: PostKind;
  body: string;
  frames: Frame[] | string | null;
  allow_reshare: number;
  hidden: number;
  hidden_reason: string | null;
  seed_key: string | null;
  created_at: string;
};

export function mapUser(row: UserRow): User {
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
    location: row.location ?? "",
    work: row.work ?? "",
    education: row.education ?? "",
    restricted: row.restricted,
    suspended: row.suspended,
    createdAt: row.created_at,
    avatarUrl: profileImageUrl(row.avatar_path),
    coverUrl: profileImageUrl(row.cover_path),
  };
}

/** Bucket for profile and cover photos. Public: these are public profile info, unlike post media. */
export const PROFILE_BUCKET = "line-profiles";

export function profileImageUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("https://")) return path;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PROFILE_BUCKET}/${path}`;
}

export function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    kind: row.kind,
    body: row.body,
    frames: framesOf(row),
    allowReshare: row.allow_reshare,
    hidden: row.hidden,
    hiddenReason: row.hidden_reason,
    seedKey: row.seed_key,
    createdAt: row.created_at,
  };
}

function framesOf(row: PostRow): Frame[] {
  if (row.kind === "text" || !row.frames) return [];
  let value: unknown = row.frames;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Frame => Boolean(item) && typeof item.path === "string" && typeof item.mime === "string",
  );
}
