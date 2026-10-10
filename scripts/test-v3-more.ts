import type { Db } from "../lib/db";

export async function run(_db: Db) {}

export async function beforeUpdate(_db: Db, _ctx: { a: number; b: number; postId: number }) {}
