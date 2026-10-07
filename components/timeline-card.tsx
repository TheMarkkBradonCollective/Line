import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { MediaPlate } from "@/components/media-plate";
import { buttonVariants } from "@/components/ui/button";
import { formatWhen, kindLabel } from "@/lib/format";
import type { TimelineItem } from "@/lib/social";

export function TimelineCard({ item }: { item: TimelineItem }) {
  return (
    <article className="desk-card">
      <header className="border-b border-rule px-4 py-3">
        <p className="kicker">On your timeline because</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight">{item.headline}</h2>
        <p className="mt-1 text-sm text-muted">{item.provenance}</p>
        {item.groupName ? <p className="mt-1 text-sm">Via the group {item.groupName}.</p> : null}
        {item.note ? <p className="mt-2 text-sm italic">“{item.note}”</p> : null}
      </header>
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 text-sm">
          <Avatar initials={item.author.initials} color={item.author.avatarColor} name={item.author.displayName} size="sm" />
          <div>
            <Link className="font-medium hover:underline" href={`/u/${item.author.username}`}>
              {item.author.displayName}
            </Link>
            <p className="text-muted">
              {kindLabel(item.kind)} · @{item.author.username}
            </p>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-[17px] leading-relaxed">{item.body}</p>
        {item.mediaLabel && item.mediaTone ? (
          <MediaPlate kind={item.kind} label={item.mediaLabel} tone={item.mediaTone} />
        ) : null}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-rule px-4 py-3">
        <Link className={buttonVariants({ variant: "stamp" })} href={`/share/${item.postId}`}>
          Share
        </Link>
        <time className="text-xs text-muted" dateTime={item.sharedAt}>
          {formatWhen(item.sharedAt)}
        </time>
      </footer>
    </article>
  );
}
