"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send } from "lucide-react";
import { SharePanel } from "@/components/share-panel";
import { cn } from "@/lib/utils";

/** The hero action. Opens the share sheet; falls back to /share/[id] without JavaScript. */
export function ShareButton({ postId, count, className }: { postId: number; count: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function close() {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      trigger.current?.focus();
    }, 180);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab" && panel.current) {
        const nodes = panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, a[href]");
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => panel.current?.querySelector<HTMLElement>("button")?.focus(), 60);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <a
        ref={trigger}
        href={`/share/${postId}`}
        data-testid="share-button"
        aria-haspopup="dialog"
        aria-label={`Share. Sent ${count} ${count === 1 ? "time" : "times"} so far`}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        className={cn(
          "press inline-flex h-11 items-center gap-2 rounded-full bg-brand pl-3.5 pr-4 text-[15px] font-semibold text-brand-on shadow-glow hover:bg-brand-deep hover:text-white",
          className,
        )}
      >
        <Send className="h-[18px] w-[18px]" strokeWidth={2.3} aria-hidden />
        Share
        <span className="rounded-full bg-black/10 px-1.5 text-[13px] tabular-nums">{count}</span>
      </a>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
              <div
                aria-hidden
                onClick={close}
                className={cn("animate-fade absolute inset-0 bg-black/45 backdrop-blur-[3px] transition-opacity duration-200", closing && "opacity-0")}
              />
              <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-title"
                data-testid="share-sheet"
                className={cn(
                  "animate-sheet relative w-full max-w-[520px] overflow-hidden rounded-t-[30px] bg-surface shadow-e3 transition-transform duration-200 md:animate-pop md:rounded-[30px]",
                  closing && "translate-y-full md:translate-y-4 md:opacity-0",
                )}
              >
                <div className="flex justify-center pb-2 pt-2.5 md:hidden" aria-hidden>
                  <span className="h-1.5 w-10 rounded-full bg-surface-3" />
                </div>
                <div className="md:pt-5">
                  <SharePanel postId={postId} onClose={close} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
