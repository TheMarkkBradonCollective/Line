import { cookies } from "next/headers";
import { getDb } from "./db";
import { getUserByUsername } from "./social";

export async function getCurrentUser() {
  const jar = await cookies();
  const username = jar.get("line_session")?.value;
  if (!username) return null;
  return getUserByUsername(getDb(), username);
}
