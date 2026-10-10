import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TabBarEditor } from "@/components/tab-bar-editor";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getTabBar } from "@/lib/social";

export const dynamic = "force-dynamic";

export default async function TabBarSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <div>
      <PageHeader kicker="Settings" title="Tab bar" subtitle="Choose the four tabs around the Create button and their order. Home always stays on." />
      <TabBarEditor saved={await getTabBar(getDb(), user.id)} />
    </div>
  );
}
