import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApp } from "./helpers.js";
import * as schema from "../src/db/schema.js";

type DB = BetterSQLite3Database<typeof schema>;

const MOCK_USER_HEADER = { "X-Mock-Wechat-User-Id": "wx-user-1" };
const ORIGINAL_WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const ORIGINAL_WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

describe("Agent binding API", () => {
  let app: Hono;
  let db: DB;

  beforeEach(() => {
    const env = createTestApp();
    app = env.app;
    db = env.db;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("WECHAT_APP_ID", ORIGINAL_WECHAT_APP_ID);
    restoreEnv("WECHAT_APP_SECRET", ORIGINAL_WECHAT_APP_SECRET);
  });

  it("应该创建绑定码并返回 pending 状态", async () => {
    const session = await createBindingSession(app);

    expect(session.binding_code).toMatch(/^[A-Z2-9]{6}$/);
    expect(session.copy_prompt).toContain(session.binding_code);
    expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());

    const current = await getCurrentBinding(app);
    expect(current.status).toBe("pending");
    expect(current.binding_code).toBe(session.binding_code);
    expect(current.copy_prompt).toBe(session.copy_prompt);
  });

  it("Skill 应该能认领绑定码并让小程序看到 bound 状态", async () => {
    const session = await createBindingSession(app);

    const claimRes = await app.request("/api/agent-bindings/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        binding_code: session.binding_code,
        agent_platform: "codex",
        agent_name: "Codex",
        skill_instance_id: "local-dev",
      }),
    });

    expect(claimRes.status).toBe(200);
    const claim = await claimRes.json();
    expect(claim.agent_token).toMatch(/^linka_agent_/);
    expect(claim.wechat_user_id).toBe("wx-user-1");
    expect(claim.bound_at).toBeDefined();

    const current = await getCurrentBinding(app);
    expect(current).toEqual({
      status: "bound",
      agent_platform: "codex",
      agent_name: "Codex",
      bound_at: claim.bound_at,
    });
  });

  it("绑定码只能认领一次", async () => {
    const session = await createBindingSession(app);
    await claimBindingCode(app, session.binding_code);

    const repeat = await app.request("/api/agent-bindings/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        binding_code: session.binding_code,
        agent_platform: "codex",
        agent_name: "Codex",
      }),
    });

    expect(repeat.status).toBe(409);
    expect(await repeat.json()).toEqual({ error: "绑定码已使用" });
  });

  it("过期绑定码不能认领", async () => {
    const session = await createBindingSession(app);
    db.update(schema.bindingSessions)
      .set({ expiresAt: "2000-01-01T00:00:00.000Z" })
      .where(eq(schema.bindingSessions.bindingCode, session.binding_code))
      .run();

    const claim = await app.request("/api/agent-bindings/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        binding_code: session.binding_code,
        agent_platform: "codex",
        agent_name: "Codex",
      }),
    });

    expect(claim.status).toBe(410);
    expect(await claim.json()).toEqual({ error: "绑定码已过期" });
  });

  it("解除绑定后应该回到 unbound 状态", async () => {
    const session = await createBindingSession(app);
    await claimBindingCode(app, session.binding_code);

    const remove = await app.request("/api/agent-bindings/current", {
      method: "DELETE",
      headers: MOCK_USER_HEADER,
    });
    expect(remove.status).toBe(200);
    expect(await remove.json()).toEqual({ status: "unbound" });

    const current = await getCurrentBinding(app);
    expect(current).toEqual({ status: "unbound" });
  });

  it("小程序应该通过 wx.login code 换取会话 token 并使用真实 openid", async () => {
    process.env.WECHAT_APP_ID = "wx-test-app";
    process.env.WECHAT_APP_SECRET = "wx-test-secret";
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("appid=wx-test-app");
      expect(url).toContain("js_code=wx-login-code");
      return new Response(
        JSON.stringify({
          openid: "real-openid-1",
          session_key: "session-key",
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const loginRes = await app.request("/api/wechat/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "wx-login-code" }),
    });
    expect(loginRes.status).toBe(200);
    const login = await loginRes.json();
    expect(login.session_token).toMatch(/^linka_wx_/);

    const sessionRes = await app.request("/api/agent-bindings/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${login.session_token}` },
    });
    expect(sessionRes.status).toBe(201);
    const session = await sessionRes.json();

    const claim = await claimBindingCode(app, session.binding_code);
    expect(claim.wechat_user_id).toBe("real-openid-1");

    const currentRes = await app.request("/api/agent-bindings/current", {
      headers: { Authorization: `Bearer ${login.session_token}` },
    });
    expect(currentRes.status).toBe(200);
    expect(await currentRes.json()).toMatchObject({
      status: "bound",
      agent_name: "Codex",
    });
  });

  it("缺少微信登录态时应该拒绝小程序端请求", async () => {
    const res = await app.request("/api/agent-bindings/sessions", {
      method: "POST",
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "请先完成微信登录",
    });
  });
});

async function createBindingSession(app: Hono) {
  const res = await app.request("/api/agent-bindings/sessions", {
    method: "POST",
    headers: MOCK_USER_HEADER,
  });
  expect(res.status).toBe(201);
  return res.json() as Promise<{
    binding_code: string;
    expires_at: string;
    copy_prompt: string;
  }>;
}

async function getCurrentBinding(app: Hono) {
  const res = await app.request("/api/agent-bindings/current", {
    headers: MOCK_USER_HEADER,
  });
  expect(res.status).toBe(200);
  return res.json() as Promise<Record<string, unknown>>;
}

async function claimBindingCode(app: Hono, bindingCode: string) {
  const res = await app.request("/api/agent-bindings/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      binding_code: bindingCode,
      agent_platform: "codex",
      agent_name: "Codex",
    }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

function restoreEnv(key: "WECHAT_APP_ID" | "WECHAT_APP_SECRET", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
