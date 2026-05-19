import { describe, it, expect, beforeEach } from "vitest";
import type { Hono } from "hono";
import { createTestApp } from "./helpers.js";

describe("Agent profile API", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp().app;
  });

  it("Agent 应该能读取默认画像偏好", async () => {
    const token = await bindAgent(app, "wx-profile-user", "Codex");

    const res = await agentRequest(app, token, "/api/agent/profile");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      profile: null,
      preferences: {
        auto_update_enabled: true,
        auto_update_frequency: "daily",
        auto_update_time: "21:00",
        auto_update_timezone: "Asia/Shanghai",
        last_auto_updated_at: null,
      },
    });
  });

  it("手动画像更新必须带用户确认", async () => {
    const token = await bindAgent(app, "wx-profile-user", "Codex");

    const res = await agentRequest(app, token, "/api/agent/profile", {
      method: "POST",
      body: {
        profile: "用户是 AI 产品负责人，重点关注 Agent 社交。",
        update_source: "manual",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "手动画像更新必须先得到用户确认",
    });
  });

  it("用户确认后 Agent 应该能更新画像", async () => {
    const token = await bindAgent(app, "wx-profile-user", "Codex");

    const update = await agentRequest(app, token, "/api/agent/profile", {
      method: "POST",
      body: {
        profile: "用户是 AI 产品负责人，正在验证微信 Agent 社交网络。",
        update_source: "manual",
        summary_direction: "突出产品规划和社交网络需求",
        confirmed: true,
      },
    });
    expect(update.status).toBe(200);
    const updateBody = await update.json();
    expect(updateBody.status).toBe("updated");
    expect(updateBody.profile).toMatchObject({
      text: "用户是 AI 产品负责人，正在验证微信 Agent 社交网络。",
      update_source: "manual",
      summary_direction: "突出产品规划和社交网络需求",
    });

    const current = await agentRequest(app, token, "/api/agent/profile");
    expect(await current.json()).toMatchObject({
      profile: {
        text: "用户是 AI 产品负责人，正在验证微信 Agent 社交网络。",
        update_source: "manual",
        summary_direction: "突出产品规划和社交网络需求",
      },
    });
  });

  it("Agent 应该能静默自动更新画像并记录更新时间", async () => {
    const token = await bindAgent(app, "wx-profile-user", "Codex");

    const update = await agentRequest(app, token, "/api/agent/profile", {
      method: "POST",
      body: {
        profile: "用户今天重点推进真机测试和 Agent 画像更新能力。",
        update_source: "auto",
      },
    });

    expect(update.status).toBe(200);
    const body = await update.json();
    expect(body.profile.update_source).toBe("auto");
    expect(body.preferences.last_auto_updated_at).toBeDefined();
  });

  it("用户应该能修改自动总结频次和时机", async () => {
    const token = await bindAgent(app, "wx-profile-user", "Codex");

    const update = await agentRequest(
      app,
      token,
      "/api/agent/profile/preferences",
      {
        method: "POST",
        body: {
          auto_update_enabled: true,
          auto_update_frequency: "weekly",
          auto_update_time: "09:30",
          auto_update_timezone: "Asia/Shanghai",
        },
      }
    );
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual({
      status: "updated",
      preferences: {
        auto_update_enabled: true,
        auto_update_frequency: "weekly",
        auto_update_time: "09:30",
        auto_update_timezone: "Asia/Shanghai",
        last_auto_updated_at: null,
      },
    });

    const manual = await agentRequest(
      app,
      token,
      "/api/agent/profile/preferences",
      {
        method: "POST",
        body: {
          auto_update_frequency: "manual",
        },
      }
    );
    expect(manual.status).toBe(200);
    expect(await manual.json()).toMatchObject({
      preferences: {
        auto_update_enabled: false,
        auto_update_frequency: "manual",
      },
    });
  });

  it("解除绑定后旧 agent token 不能再更新画像", async () => {
    const token = await bindAgent(app, "wx-profile-user", "Codex");

    const remove = await app.request("/api/agent-bindings/current", {
      method: "DELETE",
      headers: { "X-Mock-Wechat-User-Id": "wx-profile-user" },
    });
    expect(remove.status).toBe(200);

    const update = await agentRequest(app, token, "/api/agent/profile", {
      method: "POST",
      body: {
        profile: "不应写入",
        update_source: "auto",
      },
    });
    expect(update.status).toBe(401);
    expect(await update.json()).toEqual({
      error: "agent token 无效或已失效",
    });
  });
});

async function bindAgent(app: Hono, wechatUserId: string, agentName: string) {
  const sessionRes = await app.request("/api/agent-bindings/sessions", {
    method: "POST",
    headers: { "X-Mock-Wechat-User-Id": wechatUserId },
  });
  expect(sessionRes.status).toBe(201);
  const session = await sessionRes.json();

  const claimRes = await app.request("/api/agent-bindings/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      binding_code: session.binding_code,
      agent_platform: "codex",
      agent_name: agentName,
    }),
  });
  expect(claimRes.status).toBe(200);
  const claim = await claimRes.json();
  return claim.agent_token as string;
}

function agentRequest(
  app: Hono,
  token: string,
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
) {
  return app.request(path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}
