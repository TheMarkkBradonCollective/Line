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
  defaultVisibility: "private" | "public";
  restricted: number;
  suspended: number;
  createdAt: string;
};

export type PostKind = "text" | "photo" | "video" | "short" | "long_video" | "reel";

export type Post = {
  id: number;
  authorId: number;
  kind: PostKind;
  body: string;
  mediaLabel: string | null;
  mediaTone: string | null;
  listedOnDiscover: number;
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
  default_visibility: "private" | "public";
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
  listed_on_discover: number;
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
    defaultVisibility: row.default_visibility,
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
    listedOnDiscover: row.listed_on_discover,
    allowReshare: row.allow_reshare,
    hidden: row.hidden,
    hiddenReason: row.hidden_reason,
    seedKey: row.seed_key,
    createdAt: row.created_at,
  };
}
