import type { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema.js";

type DB = BetterSQLite3Database<typeof schema>;

type AgentAuthSuccess = {
  ok: true;
  binding: typeof schema.agentBindings.$inferSelect;
};

type AgentAuthFailure = {
  ok: false;
  status: 401;
  error: string;
};

export function requireAgentBinding(
  c: Context,
  database: DB
): AgentAuthSuccess | AgentAuthFailure {
  const token = getBearerToken(c);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "缺少 agent token",
    };
  }

  const binding = database
    .select()
    .from(schema.agentBindings)
    .where(
      and(
        eq(schema.agentBindings.agentToken, token),
        isNull(schema.agentBindings.revokedAt)
      )
    )
    .get();

  if (!binding) {
    return {
      ok: false,
      status: 401,
      error: "agent token 无效或已失效",
    };
  }

  return {
    ok: true,
    binding,
  };
}

function getBearerToken(c: Context) {
  const header = c.req.header("Authorization")?.trim();
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
