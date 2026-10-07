import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <p className="font-display text-xl font-bold tracking-tight">{title}</p>
      {children ? <div className="max-w-xs text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
