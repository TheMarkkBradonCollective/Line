/** Customizable bottom bar. Shared by server and client; no secrets. */
export const TAB_OPTIONS = {
  home: { href: "/timeline", label: "Home" },
  discover: { href: "/discover", label: "Discover" },
  reels: { href: "/loops", label: "Loops" },
  friends: { href: "/friends", label: "Friends" },
  profile: { href: "/profile", label: "Profile" },
  alerts: { href: "/notifications", label: "Alerts" },
  groups: { href: "/friends?tab=groups", label: "Groups" },
  posts: { href: "/posts", label: "My Posts" },
} as const;

export type TabKey = keyof typeof TAB_OPTIONS;
export const DEFAULT_TABS: TabKey[] = ["home", "reels", "discover", "profile"];
export const TAB_STORAGE_KEY = "line.tabbar";

/** Exactly 4 distinct known tabs, Home always included. Anything else falls back to the default. */
export function normalizeTabs(value: unknown): TabKey[] {
  const list = (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
    .map((v) => String(v).trim())
    .filter((v): v is TabKey => v in TAB_OPTIONS);
  const unique = [...new Set(list)];
  if (unique.length !== 4 || !unique.includes("home")) return [...DEFAULT_TABS];
  return unique;
}
