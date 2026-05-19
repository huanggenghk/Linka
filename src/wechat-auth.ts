import type { Context, Hono } from "hono";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import * as z from "zod/v4";
import * as schema from "./db/schema.js";

type DB = BetterSQLite3Database<typeof schema>;

export const MOCK_WECHAT_USER_HEADER = "X-Mock-Wechat-User-Id";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const loginSchema = z.object({
  code: z.string().trim().min(1).max(256),
});

type AuthSuccess = {
  ok: true;
  wechatUserId: string;
};

type AuthFailure = {
  ok: false;
  status: 400 | 401;
  error: string;
};

type OptionalAuthResult =
  | AuthSuccess
  | {
      ok: true;
      wechatUserId: null;
    }
  | AuthFailure;

export function registerWechatAuthRoutes(app: Hono, database: DB) {
  app.post("/api/wechat/login", async (c) => {
    const body = await readJson(c);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求参数无效" }, 400);
    }

    const config = getWechatConfig();
    if (!config) {
      return c.json({ error: "服务端未配置微信登录参数" }, 500);
    }

    let result: Awaited<ReturnType<typeof requestWechatSession>>;
    try {
      result = await requestWechatSession(parsed.data.code, config);
    } catch {
      return c.json({ error: "微信登录服务暂不可用" }, 502);
    }
    if (!result.ok) {
      return c.json({ error: result.error }, 502);
    }

    ensureWechatUser(database, result.openid);

    const sessionToken = createSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    database
      .insert(schema.wechatLoginSessions)
      .values({
        tokenHash: hashSessionToken(sessionToken),
        wechatUserId: result.openid,
        expiresAt,
        createdAt: now.toISOString(),
      })
      .run();

    return c.json({
      session_token: sessionToken,
      expires_at: expiresAt,
    });
  });
}

export function requireWechatUserId(c: Context, database: DB): AuthSuccess | AuthFailure {
  const result = optionalWechatUserId(c, database);
  if (result.ok && result.wechatUserId) return result;
  if (!result.ok) return result;
  return {
    ok: false,
    status: 401,
    error: "请先完成微信登录",
  };
}

export function optionalWechatUserId(c: Context, database: DB): OptionalAuthResult {
  const token = getBearerToken(c);
  if (token) {
    const session = database
      .select()
      .from(schema.wechatLoginSessions)
      .where(eq(schema.wechatLoginSessions.tokenHash, hashSessionToken(token)))
      .get();

    if (!session) {
      return {
        ok: false,
        status: 401,
        error: "登录已失效，请重新进入小程序",
      };
    }

    if (session.expiresAt <= new Date().toISOString()) {
      return {
        ok: false,
        status: 401,
        error: "登录已过期，请重新进入小程序",
      };
    }

    return {
      ok: true,
      wechatUserId: session.wechatUserId,
    };
  }

  const mockWechatUserId = getAllowedMockWechatUserId(c);
  if (mockWechatUserId) {
    ensureWechatUser(database, mockWechatUserId);
    return {
      ok: true,
      wechatUserId: mockWechatUserId,
    };
  }

  return {
    ok: true,
    wechatUserId: null,
  };
}

export function ensureWechatUser(database: DB, wechatUserId: string) {
  database
    .insert(schema.wechatUsers)
    .values({ id: wechatUserId })
    .onConflictDoNothing()
    .run();
}

export async function readJson(c: Context) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function getBearerToken(c: Context) {
  const header = c.req.header("Authorization")?.trim();
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getAllowedMockWechatUserId(c: Context) {
  if (!canUseMockWechatUserHeader()) return null;

  const value = c.req.header(MOCK_WECHAT_USER_HEADER)?.trim();
  if (!value || value.length > 128) return null;
  return value;
}

function canUseMockWechatUserHeader() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.ALLOW_MOCK_WECHAT_AUTH === "1"
  );
}

function getWechatConfig() {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

async function requestWechatSession(
  code: string,
  config: { appId: string; appSecret: string }
) {
  const params = new URLSearchParams({
    appid: config.appId,
    secret: config.appSecret,
    js_code: code,
    grant_type: "authorization_code",
  });

  const response = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`
  );
  const data = (await response.json()) as {
    openid?: unknown;
    errmsg?: unknown;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      error: "微信登录服务暂不可用",
    };
  }

  if (typeof data.openid !== "string" || !data.openid) {
    const message = typeof data.errmsg === "string" ? data.errmsg : "登录凭证无效";
    return {
      ok: false as const,
      error: `微信登录失败：${message}`,
    };
  }

  return {
    ok: true as const,
    openid: data.openid,
  };
}

function createSessionToken() {
  return `linka_wx_${randomBytes(32).toString("base64url")}`;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
