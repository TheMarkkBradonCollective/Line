"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Layers, Lock, Search, Send, UserRound, Users, X } from "lucide-react";
import { shareFromSheetAction, shareSheetAction, type SheetResult } from "@/app/actions";
import { Avatar, AvatarStack } from "@/components/avatar";
import { cn } from "@/lib/utils";

type Sheet = Awaited<ReturnType<typeof shareSheetAction>>;

function thumbStyle(tone: string | null) {
  const [a, b] = (tone ?? "#00bf8f,#009e78").split(",").map((part) => part.trim());
  return { background: `linear-gradient(135deg, ${a}, ${b ?? a})` };
}

function SkeletonRows() {
  return (
    <div className="grid gap-3 px-5 py-4" aria-busy="true" aria-label="Loading friends">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="skeleton h-11 w-11 rounded-full" />
          <span className="grid flex-1 gap-1.5">
            <span className="skeleton h-3.5 w-32 rounded-full" />
            <span className="skeleton h-3 w-20 rounded-full" />
          </span>
          <span className="skeleton h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function CheckDot({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-spring",
        on ? "scale-100 border-brand bg-brand text-brand-on" : "border-line text-transparent",
        disabled && "opacity-40",
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3.2} />
    </span>
  );
}

/**
 * The share picker. Used inside the bottom sheet and on /share/[postId] as a full page.
 * Every pick becomes a delivery to that person’s feed. There is no public option.
 */
export function SharePanel({
  postId,
  onClose,
  variant = "sheet",
}: {
  postId: number;
  onClose?: () => void;
  variant?: "sheet" | "page";
}) {
  const router = useRouter();
  const [data, setData] = useState<Sheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<Set<number>>(new Set());
  const [lists, setLists] = useState<Set<number>>(new Set());
  const [self, setSelf] = useState(false);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<SheetResult | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    shareSheetAction(postId)
      .then((value) => live && setData(value))
      .catch((error: unknown) => live && setLoadError(error instanceof Error ? error.message : "Could not open sharing."));
    return () => {
      live = false;
    };
  }, [postId]);

  const shown = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return data.friends;
    return data.friends.filter(
      (friend) => friend.displayName.toLowerCase().includes(needle) || friend.username.toLowerCase().includes(needle),
    );
  }, [data, query]);

  const picked = useMemo(() => {
    if (!data) return [];
    const people = new Map<number, { initials: string; avatarColor: string; displayName: string }>();
    for (const friend of data.friends) if (friends.has(friend.id)) people.set(friend.id, friend);
    for (const group of data.groups) if (groups.has(group.id)) group.members.forEach((member) => people.set(member.id, member));
    for (const list of data.lists) if (lists.has(list.id)) list.members.forEach((member) => people.set(member.id, member));
    return [...people.values()];
  }, [data, friends, groups, lists]);

  const total = picked.length + (self ? 1 : 0);
  const blocked = Boolean(data?.restricted || data?.paused);

  function toggle(set: Set<number>, update: (next: Set<number>) => void, id: number) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  }

  function send() {
    if (!data || !total) return;
    startTransition(async () => {
      const answer = await shareFromSheetAction({
        postId,
        self,
        friendIds: [...friends],
        groupIds: [...groups],
        listIds: [...lists],
        note,
      });
      setResult(answer);
      if (answer.ok) router.refresh();
    });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center px-6 pb-8 pt-6 text-center" role="status" aria-live="polite">
        <span className="animate-pop relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep shadow-glow">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 className="mt-5 font-display text-[28px] font-bold tracking-tight">Sent</h2>
        <p className="mt-1 text-[15px] text-ink-2">
          On {result.delivered.length} {result.delivered.length === 1 ? "feed" : "feeds"}. Only the people you picked can see it.
        </p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {result.delivered.map((person, index) => (
            <li
              key={person.userId}
              className="animate-rise flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm font-semibold"
              style={{ ["--i" as string]: index }}
            >
              <Avatar initials={person.initials} color={person.color} name={person.name} size="xs" />
              {person.name}
            </li>
          ))}
        </ul>
        {result.rejected.length ? (
          <div className="banner-warn mt-5 w-full px-3.5 py-3 text-left text-sm">
            <p className="font-semibold">Not delivered</p>
            <ul className="mt-1 grid gap-0.5">
              {result.rejected.map((item, index) => (
                <li key={index}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {variant === "sheet" ? (
          <button type="button" onClick={onClose} className="press mt-6 h-12 w-full rounded-full bg-ink text-[15px] font-semibold text-bg">
            Done
          </button>
        ) : (
          <Link href="/timeline" className="press mt-6 flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-bg">
            Back to home
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", variant === "sheet" ? "max-h-[min(86dvh,760px)]" : "")}>
      <div className="flex items-start gap-3 px-5 pb-3 pt-1">
        <div className="min-w-0 flex-1">
          <h2 id="share-title" className="font-display text-[24px] font-bold tracking-tight">
            Share with people
          </h2>
          <p className="text-[13px] text-ink-3">It lands in their feed and nobody else’s. No public option.</p>
        </div>
        {variant === "sheet" ? (
          <button type="button" onClick={onClose} aria-label="Close" className="tap press -mr-2 -mt-1 flex items-center justify-center rounded-full text-ink-2 hover:bg-surface-2">
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      {data ? (
        <div className="mx-5 mb-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
          <span className="h-12 w-12 shrink-0 rounded-xl" style={thumbStyle(data.post.mediaTone)} aria-hidden />
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-ink-3">Made by {data.post.authorName}</span>
            <span className="line-clamp-2 text-[13.5px] font-medium leading-snug">{data.post.body}</span>
          </span>
        </div>
      ) : null}

      {loadError ? (
        <p className="banner-warn mx-5 mb-4 px-3.5 py-3 text-sm">{loadError}</p>
      ) : !data ? (
        <SkeletonRows />
      ) : (
        <>
          {blocked ? (
            <p className="banner-warn mx-5 mb-3 px-3.5 py-2.5 text-sm">
              {data.paused ? "Sharing is paused right now." : "This account is restricted and cannot share."}
            </p>
          ) : null}
          <div className="px-5 pb-2">
            <label className="relative block">
              <span className="sr-only">Search friends</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your friends"
                className="field rounded-full bg-surface-2 pl-10"
                style={{ borderColor: "transparent" }}
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
            {!query ? (
              <>
                <button
                  type="button"
                  disabled={!data.self.ok}
                  aria-pressed={self}
                  onClick={() => setSelf((value) => !value)}
                  className={cn(
                    "press flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left disabled:opacity-50",
                    self ? "bg-brand-soft" : "hover:bg-surface-2",
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-white">
                    <UserRound className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">My feed</span>
                    <span className="block text-[12.5px] text-ink-3">{data.self.reason ?? "Only you see it there"}</span>
                  </span>
                  <CheckDot on={self} disabled={!data.self.ok} />
                </button>

                {data.groups.length || data.lists.length ? (
                  <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-5 py-2.5">
                    {data.groups.map((group) => {
                      const on = groups.has(group.id);
                      return (
                        <button
                          key={`g${group.id}`}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(groups, setGroups, group.id)}
                          className={cn("chip press shrink-0", on && "border-brand bg-brand-soft text-brand-strong")}
                        >
                          <Users className="h-4 w-4" aria-hidden />
                          {group.name}
                          <span className="text-ink-3">{group.members.length}</span>
                        </button>
                      );
                    })}
                    {data.lists.map((list) => {
                      const on = lists.has(list.id);
                      return (
                        <button
                          key={`l${list.id}`}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(lists, setLists, list.id)}
                          className={cn("chip press shrink-0", on && "border-brand bg-brand-soft text-brand-strong")}
                        >
                          <Layers className="h-4 w-4" aria-hidden />
                          {list.name}
                          <span className="text-ink-3">{list.members.length}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <p className="px-2 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Friends</p>
              </>
            ) : null}

            <ul className="grid gap-0.5">
              {shown.map((friend) => {
                const on = friends.has(friend.id);
                return (
                  <li key={friend.id}>
                    <button
                      type="button"
                      disabled={!friend.ok}
                      aria-pressed={on}
                      onClick={() => toggle(friends, setFriends, friend.id)}
                      className={cn(
                        "press flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left disabled:cursor-not-allowed",
                        on ? "bg-brand-soft" : "hover:bg-surface-2",
                      )}
                    >
                      <span className={cn("relative", !friend.ok && "opacity-45")}>
                        <Avatar initials={friend.initials} color={friend.avatarColor} name={friend.displayName} size="md" />
                        {friend.alreadySent ? (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-on ring-2 ring-[rgb(var(--surface))]">
                            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[15px] font-semibold", !friend.ok && "text-ink-3")}>{friend.displayName}</span>
                        <span className="flex items-center gap-1 truncate text-[12.5px] text-ink-3">
                          {friend.reason && !friend.alreadySent ? <Lock className="h-3 w-3 shrink-0" aria-hidden /> : null}
                          {friend.reason ?? `@${friend.username}`}
                        </span>
                      </span>
                      <CheckDot on={on} disabled={!friend.ok} />
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-ink-3">
                  {query ? `No friend matches “${query}”.` : "No friends yet. Add someone from Friends."}
                </li>
              ) : null}
            </ul>
          </div>

          <div className="safe-bottom border-t border-line/70 bg-surface px-5 pb-4 pt-3">
            {result && !result.ok ? (
              <p className="banner-warn mb-3 flex items-start gap-2 px-3 py-2 text-sm" role="alert">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {result.message}
                  {result.rejected.map((item, index) => (
                    <span key={index} className="block">
                      {item.name}: {item.reason}
                    </span>
                  ))}
                </span>
              </p>
            ) : null}
            <label className="sr-only" htmlFor={`note-${postId}`}>
              Note
            </label>
            <input
              id={`note-${postId}`}
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a note (optional)"
              className="field mb-3 rounded-full"
            />
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {total ? (
                  <>
                    <AvatarStack people={picked} size="sm" max={4} />
                    <span className="truncate text-sm font-semibold text-ink-2">
                      {self && !picked.length ? "Your feed" : `${total} ${total === 1 ? "person" : "people"}`}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-ink-3">Pick at least one</span>
                )}
              </div>
              <button
                type="button"
                onClick={send}
                disabled={!total || pending || blocked}
                className="press relative flex h-12 min-w-[132px] items-center justify-center gap-2 overflow-hidden rounded-full bg-brand px-6 text-[15px] font-semibold text-brand-on shadow-glow transition-opacity hover:bg-brand-deep hover:text-white disabled:opacity-40 disabled:shadow-none"
              >
                <Send className={cn("h-[18px] w-[18px]", pending && "fly")} aria-hidden />
                {pending ? "Sending" : total ? `Send to ${total}` : "Send"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
