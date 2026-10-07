import { reportAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ReportForm({
  targetType,
  targetId,
  returnTo,
}: {
  targetType: "post" | "video" | "profile" | "message" | "account";
  targetId: number;
  returnTo: string;
}) {
  return (
    <form action={reportAction} className="grid gap-2 border border-rule bg-card p-3">
      <p className="kicker">Report</p>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <select className="field" name="category" defaultValue="spam">
        <option value="harassment">Harassment</option>
        <option value="spam">Spam</option>
        <option value="abuse">Abuse</option>
        <option value="other">Other</option>
      </select>
      <textarea className="field min-h-20" name="details" placeholder="What should staff look at?" />
      <Button type="submit" variant="outline" size="sm">
        File report
      </Button>
    </form>
  );
}
