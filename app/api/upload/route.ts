import { readUploadTicket } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { storeUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

const fail = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * PUT /api/upload?ticket=… with the file as the body.
 * The ticket (signed by prepareUploadsAction, 15 minutes) names one path inside the signed-in
 * author's own folder, its type and size. Nothing else can be written here.
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.suspended || user.restricted) return fail(401, "Sign in to upload.");
  const ticket = await readUploadTicket(new URL(request.url).searchParams.get("ticket") || "");
  if (!ticket || ticket.uid !== user.id || !ticket.path.startsWith(`u/${user.id}/`)) return fail(403, "That upload link expired. Add the file again.");
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (type !== ticket.mime) return fail(400, "That file type doesn’t match.");
  const body = await request.arrayBuffer();
  if (body.byteLength !== ticket.size) return fail(400, "The upload was cut off. Try again.");
  try {
    await storeUpload(ticket.path, ticket.mime, body);
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Upload failed.");
  }
  return Response.json({ path: ticket.path }, { headers: { "Cache-Control": "private, no-store" } });
}
