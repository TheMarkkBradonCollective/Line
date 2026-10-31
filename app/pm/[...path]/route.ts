import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Public profile and cover photos (prefix p/ only). Post media never goes through here. */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = path.join("/");
  if (path[0] !== "p" || key.includes("..") || !/^p\/\d+\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
  const obj = await getObject(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: { "Content-Type": obj.mime, "Content-Length": String(obj.size), "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
