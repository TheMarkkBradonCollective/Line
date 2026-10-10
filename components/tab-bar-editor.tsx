"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Lock, Plus, RotateCcw, X } from "lucide-react";
import { saveTabBarAction } from "@/app/actions";
import { DEFAULT_TABS, normalizeTabs, TAB_OPTIONS, TAB_STORAGE_KEY, type TabKey } from "@/lib/tab-bar";
import { cn } from "@/lib/utils";

/** Settings → Tab bar. Pick and order the 4 side tabs; Create stays fixed in the middle; Home can't be removed. */
export function TabBarEditor({ saved }: { saved: string | null }) {
  const [keys, setKeys] = useState<TabKey[]>(saved ? normalizeTabs(saved) : [...DEFAULT_TABS]);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (saved) return;
    try {
      const local = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (local) setKeys(normalizeTabs(local));
    } catch {
      /* ignore */
    }
  }, [saved]);

  const all = Object.keys(TAB_OPTIONS) as TabKey[];
  const spare = all.filter((k) => !keys.includes(k));

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    setKeys(next);
  }
  function remove(key: TabKey) {
    if (key === "home") return;
    setKeys(keys.filter((k) => k !== key));
  }
  function add(key: TabKey) {
    if (keys.length >= 4) return;
    setKeys([...keys, key]);
  }
  function persist(next: TabKey[] | null) {
    start(async () => {
      const result = await saveTabBarAction(next);
      const value = result.tabs as TabKey[];
      try {
        if (next) window.localStorage.setItem(TAB_STORAGE_KEY, value.join(","));
        else window.localStorage.removeItem(TAB_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setKeys(value);
      window.dispatchEvent(new CustomEvent("line-tabbar", { detail: value }));
      setStatus(result.saved ? "Saved." : "Saved on this device. It will sync to your account after the next LINE update.");
    });
  }

  const slot = (i: number) => (i < 2 ? `Left ${i + 1}` : `Right ${i - 1}`);

  return (
    <div className="grid gap-4 px-4 md:px-0" data-testid="tab-bar-editor">
      {/* Live preview with Create fixed in the middle */}
      <div className="surface-card p-3">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Preview</p>
        <div className="flex h-14 items-stretch rounded-2xl bg-surface-2 px-2">
          {[0, 1].map((i) => (
            <span key={i} className="flex flex-1 basis-0 items-center justify-center text-[12.5px] font-semibold text-ink-2">{keys[i] ? TAB_OPTIONS[keys[i]].label : "—"}</span>
          ))}
          <span className="flex w-16 shrink-0 items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand text-white"><Plus className="h-6 w-6" aria-hidden /></span>
          </span>
          {[2, 3].map((i) => (
            <span key={i} className="flex flex-1 basis-0 items-center justify-center text-[12.5px] font-semibold text-ink-2">{keys[i] ? TAB_OPTIONS[keys[i]].label : "—"}</span>
          ))}
        </div>
      </div>

      <section className="surface-card overflow-hidden">
        <h2 className="px-4 pb-1 pt-4 font-display text-[17px] font-bold tracking-tight">On your bar · {keys.length}/4</h2>
        <ul className="divide-y divide-line/70">
          {keys.map((key, i) => (
            <li key={key} className="flex min-h-[56px] items-center gap-2 px-4">
              <span className="w-16 shrink-0 text-[12px] font-semibold uppercase text-ink-3">{slot(i)}</span>
              <span className="flex-1 text-[15px] font-semibold">{TAB_OPTIONS[key].label}</span>
              <button type="button" aria-label={`Move ${TAB_OPTIONS[key].label} up`} onClick={() => move(i, -1)} disabled={i === 0} className="tap press flex items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" aria-hidden /></button>
              <button type="button" aria-label={`Move ${TAB_OPTIONS[key].label} down`} onClick={() => move(i, 1)} disabled={i === keys.length - 1} className="tap press flex items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" aria-hidden /></button>
              {key === "home" ? (
                <span className="tap flex items-center justify-center text-ink-3" title="Home is always on the bar"><Lock className="h-4 w-4" aria-hidden /><span className="sr-only">Home is always on the bar</span></span>
              ) : (
                <button type="button" aria-label={`Remove ${TAB_OPTIONS[key].label}`} onClick={() => remove(key)} className="tap press flex items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"><X className="h-4 w-4" aria-hidden /></button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card p-4">
        <h2 className="font-display text-[17px] font-bold tracking-tight">Add a tab</h2>
        <p className="text-[12.5px] text-ink-3">Anything not on your bar stays in the menu.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {spare.map((key) => (
            <button key={key} type="button" disabled={keys.length >= 4} onClick={() => add(key)} className={cn("chip press min-h-[40px] px-3.5", keys.length >= 4 && "opacity-40")}>
              <Plus className="h-4 w-4" aria-hidden /> {TAB_OPTIONS[key].label}
            </button>
          ))}
        </div>
      </section>

      {status ? <p className="flex items-center gap-2 text-[13.5px] font-semibold text-brand-strong" role="status"><Check className="h-4 w-4" aria-hidden /> {status}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={pending || keys.length !== 4} onClick={() => persist(keys)} className="press h-12 flex-1 rounded-full bg-brand font-semibold text-brand-on disabled:opacity-50" data-testid="save-tab-bar">
          {keys.length === 4 ? "Save" : `Pick ${4 - keys.length} more`}
        </button>
        <button type="button" disabled={pending} onClick={() => persist(null)} className="press inline-flex h-12 items-center gap-1.5 rounded-full bg-surface-2 px-5 font-semibold text-ink" data-testid="reset-tab-bar">
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset to default
        </button>
      </div>
    </div>
  );
}
