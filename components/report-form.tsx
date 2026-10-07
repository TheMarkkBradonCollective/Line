import { Flag } from "lucide-react";
import { reportAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ReportForm({
  targetType,
  targetId,
  returnTo,
  open = false,
}: {
  targetType: "post" | "video" | "profile" | "message" | "account";
  targetId: number;
  returnTo: string;
  open?: boolean;
}) {
  return (
    <details className="group surface-card overflow-hidden" open={open}>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 px-4 text-sm font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <Flag className="h-4 w-4" aria-hidden />
        Report {targetType === "profile" ? "this profile" : "this post"}
        <span className="ml-auto text-ink-3 transition group-open:rotate-45">+</span>
      </summary>
      <form action={reportAction} className="grid gap-2.5 border-t border-line/70 p-4">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="grid gap-1.5 text-sm font-semibold">
          Reason
          <select className="field" name="category" defaultValue="spam">
            <option value="harassment">Harassment</option>
            <option value="spam">Spam</option>
            <option value="abuse">Abuse</option>
            <option value="other">Other</option>
          </select>
        </label>
        <textarea className="field min-h-20" name="details" placeholder="What should staff look at?" aria-label="Details" />
        <Button type="submit" variant="outline" size="sm">
          File report
        </Button>
      </form>
    </details>
  );
}
