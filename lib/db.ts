import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { seed } from "./seed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  who_can_share TEXT NOT NULL DEFAULT 'friends',
  who_can_add TEXT NOT NULL DEFAULT 'everyone',
  who_can_reshare TEXT NOT NULL DEFAULT 'recipients',
  default_visibility TEXT NOT NULL DEFAULT 'private',
  restricted INTEGER NOT NULL DEFAULT 0,
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (user_id, permission),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  addressee_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (addressee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id),
  FOREIGN KEY (blocked_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friend_groups (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  allows_inbound_share INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friend_group_members (
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES friend_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friend_lists (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friend_list_members (
  list_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (list_id, user_id),
  FOREIGN KEY (list_id) REFERENCES friend_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS share_allow (
  user_id INTEGER NOT NULL,
  allowed_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, allowed_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (allowed_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  media_label TEXT,
  media_tone TEXT,
  allow_reshare INTEGER NOT NULL DEFAULT 1,
  hidden INTEGER NOT NULL DEFAULT 0,
  hidden_reason TEXT,
  seed_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  share_kind TEXT NOT NULL,
  group_id INTEGER,
  list_id INTEGER,
  parent_share_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (post_id, from_user_id, to_user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  post_id INTEGER,
  share_id INTEGER,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  queue TEXT NOT NULL DEFAULT 'moderator',
  resolution TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assignee_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL,
  staff_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  reason TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  case_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (staff_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions (
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'like',
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id, kind),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_shares_to ON shares(to_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shares_post ON shares(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id, kind);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_queue ON reports(queue, status);

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit history cannot be erased');
END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit history cannot be altered');
END;
`;

export function defaultDbPath() {
  return process.env.LINE_DB_PATH || path.join(process.cwd(), "data", "line.sqlite");
}

export function openDatabase(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: Database.Database) {
  db.exec(SCHEMA);
}

export function createDatabase(filePath: string) {
  const db = openDatabase(filePath);
  migrate(db);
  return db;
}

const globalForDb = globalThis as unknown as { lineDb?: Database.Database; lineDbPath?: string };

export function getDb() {
  const filePath = defaultDbPath();
  if (!globalForDb.lineDb || globalForDb.lineDbPath !== filePath) {
    const db = createDatabase(filePath);
    seedIfEmpty(db);
    globalForDb.lineDb = db;
    globalForDb.lineDbPath = filePath;
  }
  return globalForDb.lineDb;
}

export function seedIfEmpty(db: Database.Database) {
  const run = db.transaction(() => {
    const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
    if (row.c > 0) return;
    seed(db);
  });
  run();
}
