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
};

/** short and long_video are older names. New posts are text, photo, video, or reel. */
export type PostKind = "text" | "photo" | "video" | "short" | "long_video" | "reel";

export type Frame = { label: string; tone: string };

export type Post = {
  id: number;
  authorId: number;
  kind: PostKind;
  body: string;
  mediaLabel: string | null;
  mediaTone: string | null;
  /** Every frame of the post. Photo posts can have several; video and reels have one. */
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
  media_label: string | null;
  media_tone: string | null;
  photos?: string | null;
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
  };
}

export function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    kind: row.kind,
    body: row.body,
    mediaLabel: row.media_label,
    mediaTone: row.media_tone,
    frames: framesOf(row),
    allowReshare: row.allow_reshare,
    hidden: row.hidden,
    hiddenReason: row.hidden_reason,
    seedKey: row.seed_key,
    createdAt: row.created_at,
  };
}

function framesOf(row: PostRow): Frame[] {
  if (row.kind === "text") return [];
  if (row.photos) {
    try {
      const parsed = JSON.parse(row.photos) as Frame[];
      if (Array.isArray(parsed) && parsed.length) return parsed.filter((item) => item && item.label);
    } catch {
      // fall through to the single frame
    }
  }
  return row.media_label ? [{ label: row.media_label, tone: row.media_tone ?? "#00bf8f,#009e78" }] : [];
}
