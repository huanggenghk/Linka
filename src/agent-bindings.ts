import type { Hono } from "hono";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { randomBytes, randomInt } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import * as z from "zod/v4";
import * as schema from "./db/schema.js";
import { readJson, requireWechatUserId } from "./wechat-auth.js";

type DB = BetterSQLite3Database<typeof schema>;

const BINDING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BINDING_CODE_LENGTH = 6;
const BINDING_TTL_MS = 10 * 60 * 1000;

const claimSchema = z.object({
  binding_code: z.string().trim().min(1),
  agent_platform: z.string().trim().min(1).max(64),
  agent_name: z.string().trim().min(1).max(128),
  skill_instance_id: z.string().trim().min(1).max(128).optional(),
});

export function registerAgentBindingRoutes(app: Hono, database: DB) {
  app.post("/api/agent-bindings/sessions", async (c) => {
    const auth = requireWechatUserId(c, database);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }
    const wechatUserId = auth.wechatUserId;

    const id = uuidv4();
    const bindingCode = createUniqueBindingCode(database);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + BINDING_TTL_MS).toISOString();
    const copyPrompt = `请使用 Linka Skill 绑定我的账号，绑定码是 ${bindingCode}。`;

    database
      .insert(schema.bindingSessions)
      .values({
        id,
        wechatUserId,
        bindingCode,
        copyPrompt,
        expiresAt,
        createdAt: now.toISOString(),
      })
      .run();

    return c.json(
      {
        binding_code: bindingCode,
        expires_at: expiresAt,
        copy_prompt: copyPrompt,
      },
      201
    );
  });

  app.post("/api/agent-bindings/claim", async (c) => {
    const body = await readJson(c);
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求参数无效" }, 400);
    }

    const now = new Date().toISOString();
    const session = database
      .select()
      .from(schema.bindingSessions)
      .where(eq(schema.bindingSessions.bindingCode, parsed.data.binding_code))
      .get();

    if (!session) {
      return c.json({ error: "绑定码无效" }, 404);
    }

    if (session.claimedAt) {
      return c.json({ error: "绑定码已使用" }, 409);
    }

    if (session.expiresAt <= now) {
      return c.json({ error: "绑定码已过期" }, 410);
    }

    const bindingId = uuidv4();
    const agentToken = createAgentToken();

    database.transaction((tx) => {
      tx.update(schema.agentBindings)
        .set({ revokedAt: now })
        .where(
          and(
            eq(schema.agentBindings.wechatUserId, session.wechatUserId),
            isNull(schema.agentBindings.revokedAt)
          )
        )
        .run();

      tx.insert(schema.agentBindings)
        .values({
          id: bindingId,
          wechatUserId: session.wechatUserId,
          agentPlatform: parsed.data.agent_platform,
          agentName: parsed.data.agent_name,
          skillInstanceId: parsed.data.skill_instance_id ?? null,
          agentToken,
          boundAt: now,
        })
        .run();

      tx.update(schema.bindingSessions)
        .set({ claimedAt: now })
        .where(eq(schema.bindingSessions.id, session.id))
        .run();
    });

    return c.json({
      agent_token: agentToken,
      wechat_user_id: session.wechatUserId,
      bound_at: now,
    });
  });

  app.get("/api/agent-bindings/current", async (c) => {
    const auth = requireWechatUserId(c, database);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }
    const wechatUserId = auth.wechatUserId;

    const activeBinding = getActiveBinding(database, wechatUserId);
    if (activeBinding) {
      return c.json({
        status: "bound",
        agent_platform: activeBinding.agentPlatform,
        agent_name: activeBinding.agentName,
        bound_at: activeBinding.boundAt,
      });
    }

    const pendingSession = database
      .select()
      .from(schema.bindingSessions)
      .where(
        and(
          eq(schema.bindingSessions.wechatUserId, wechatUserId),
          isNull(schema.bindingSessions.claimedAt),
          gt(schema.bindingSessions.expiresAt, new Date().toISOString())
        )
      )
      .orderBy(desc(schema.bindingSessions.createdAt))
      .get();

    if (pendingSession) {
      return c.json({
        status: "pending",
        binding_code: pendingSession.bindingCode,
        expires_at: pendingSession.expiresAt,
        copy_prompt: pendingSession.copyPrompt,
      });
    }

    return c.json({ status: "unbound" });
  });

  app.delete("/api/agent-bindings/current", async (c) => {
    const auth = requireWechatUserId(c, database);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }
    const wechatUserId = auth.wechatUserId;

    const now = new Date().toISOString();
    database
      .update(schema.agentBindings)
      .set({ revokedAt: now })
      .where(
        and(
          eq(schema.agentBindings.wechatUserId, wechatUserId),
          isNull(schema.agentBindings.revokedAt)
        )
      )
      .run();

    return c.json({ status: "unbound" });
  });
}

export function getActiveBinding(database: DB, wechatUserId: string) {
  return database
    .select()
    .from(schema.agentBindings)
    .where(
      and(
        eq(schema.agentBindings.wechatUserId, wechatUserId),
        isNull(schema.agentBindings.revokedAt)
      )
    )
    .orderBy(desc(schema.agentBindings.boundAt))
    .get();
}

function createUniqueBindingCode(database: DB) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createBindingCode();
    const existing = database
      .select({ id: schema.bindingSessions.id })
      .from(schema.bindingSessions)
      .where(eq(schema.bindingSessions.bindingCode, code))
      .get();
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique binding code");
}

function createBindingCode() {
  let code = "";
  for (let i = 0; i < BINDING_CODE_LENGTH; i += 1) {
    code += BINDING_CODE_ALPHABET[randomInt(BINDING_CODE_ALPHABET.length)];
  }
  return code;
}

function createAgentToken() {
  return `linka_agent_${randomBytes(32).toString("base64url")}`;
}
