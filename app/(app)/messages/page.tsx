import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/session";

export default async function MessagesPage() {
  if (!(await getCurrentUser())) redirect("/");
  return (
    <div>
      <PageHeader title="Messages" />
      <div className="px-4 md:px-0">
        <EmptyState icon={MessageCircle} title="Messages are on the way">Chats with friends land here soon.</EmptyState>
      </div>
    </div>
  );
}
