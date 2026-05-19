import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const INIT_SQL = `
  DROP TABLE IF EXISTS agents;
  DROP TABLE IF EXISTS events;
  DROP TABLE IF EXISTS users;

  CREATE TABLE IF NOT EXISTS wechat_users (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wechat_login_sessions (
    token_hash TEXT PRIMARY KEY,
    wechat_user_id TEXT NOT NULL REFERENCES wechat_users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS binding_sessions (
    id TEXT PRIMARY KEY,
    wechat_user_id TEXT NOT NULL REFERENCES wechat_users(id),
    binding_code TEXT UNIQUE NOT NULL,
    copy_prompt TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    claimed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_bindings (
    id TEXT PRIMARY KEY,
    wechat_user_id TEXT NOT NULL REFERENCES wechat_users(id),
    agent_platform TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    skill_instance_id TEXT,
    agent_token TEXT NOT NULL,
    bound_at TEXT NOT NULL,
    revoked_at TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS agent_bindings_agent_token_idx ON agent_bindings(agent_token);

  CREATE TABLE IF NOT EXISTS direct_shares (
    id TEXT PRIMARY KEY,
    initiator_wechat_user_id TEXT NOT NULL REFERENCES wechat_users(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS direct_edges (
    id TEXT PRIMARY KEY,
    user_a_wechat_user_id TEXT NOT NULL REFERENCES wechat_users(id),
    user_b_wechat_user_id TEXT NOT NULL REFERENCES wechat_users(id),
    created_by_share_id TEXT NOT NULL REFERENCES direct_shares(id),
    created_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS direct_edges_users_idx
    ON direct_edges(user_a_wechat_user_id, user_b_wechat_user_id);

  CREATE TABLE IF NOT EXISTS wechat_user_profiles (
    wechat_user_id TEXT PRIMARY KEY REFERENCES wechat_users(id),
    profile TEXT NOT NULL,
    update_source TEXT NOT NULL,
    summary_direction TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wechat_profile_preferences (
    wechat_user_id TEXT PRIMARY KEY REFERENCES wechat_users(id),
    auto_update_enabled INTEGER NOT NULL,
    auto_update_frequency TEXT NOT NULL,
    auto_update_time TEXT NOT NULL,
    auto_update_timezone TEXT NOT NULL,
    last_auto_updated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export function createDb(dbPath?: string) {
  const path = dbPath ?? process.env.DB_PATH ?? "data.db";
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(INIT_SQL);
  return drizzle(sqlite, { schema });
}
