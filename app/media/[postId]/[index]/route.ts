import { canViewPost } from "@/lib/access";
import { getDb } from "@/lib/db";
import { renderFrameSvg } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";
import { getPost } from "@/lib/social";

export const dynamic = "force-dynamic";

const NOT_FOUND = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain" } });

/**
 * Media for a post. Same gate as the post page: you made it, it was shared to you,
 * or you are staff opening it as a case. Anything else is a 404, never a hint that it exists.
 */
export async function GET(_request: Request, context: { params: Promise<{ postId: string; index: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NOT_FOUND();
  const { postId, index } = await context.params;
  const id = Number(postId);
  const at = Number(index);
  if (!Number.isInteger(id) || !Number.isInteger(at) || at < 0) return NOT_FOUND();
  const db = getDb();
  const post = getPost(db, id);
  if (!post || !canViewPost(db, user, post, { allowStaff: true })) return NOT_FOUND();
  const frame = post.frames[at];
  if (!frame) return NOT_FOUND();
  return new Response(renderFrameSvg({ label: frame.label, tone: frame.tone }), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
