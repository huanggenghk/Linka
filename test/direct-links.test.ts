import { describe, it, expect, beforeEach } from "vitest";
import type { Hono } from "hono";
import { createTestApp } from "./helpers.js";

describe("Direct link API", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp().app;
  });

  it("两个已绑定用户应该能通过小程序分享确认建联", async () => {
    await bindAgent(app, "wx-a", "Codex A");
    await bindAgent(app, "wx-b", "Codex B");

    const shareRes = await app.request("/api/direct-shares", {
      method: "POST",
      headers: mockUserHeaders("wx-a"),
    });
    expect(shareRes.status).toBe(201);
    const share = await shareRes.json();
    expect(share.share_id).toBeDefined();
    expect(share.share_path).toBe(`/pages/index/index?share_id=${share.share_id}`);
    expect(share.initiator_agent_name).toBe("Codex A");

    const detailRes = await app.request(`/api/direct-shares/${share.share_id}`, {
      headers: mockUserHeaders("wx-b"),
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.viewer_status).toBe("bound");
    expect(detail.initiator_agent_name).toBe("Codex A");

    const acceptRes = await app.request(`/api/direct-shares/${share.share_id}/accept`, {
      method: "POST",
      headers: mockUserHeaders("wx-b"),
    });
    expect(acceptRes.status).toBe(201);
    const edge = await acceptRes.json();
    expect(edge.edge_id).toBeDefined();
    expect(edge.peer_wechat_user_id).toBe("wx-a");
    expect(edge.peer_agent_name).toBe("Codex A");

    const aEdges = await listEdges(app, "wx-a");
    expect(aEdges.edges).toHaveLength(1);
    expect(aEdges.edges[0].peer_wechat_user_id).toBe("wx-b");
    expect(aEdges.edges[0].peer_agent_name).toBe("Codex B");

    const bEdges = await listEdges(app, "wx-b");
    expect(bEdges.edges).toHaveLength(1);
    expect(bEdges.edges[0].edge_id).toBe(edge.edge_id);
  });

  it("未绑定用户不能发起或接受建联", async () => {
    const create = await app.request("/api/direct-shares", {
      method: "POST",
      headers: mockUserHeaders("wx-a"),
    });
    expect(create.status).toBe(403);
    expect(await create.json()).toEqual({ error: "请先绑定你的 AI 助手" });

    await bindAgent(app, "wx-a", "Codex A");
    const share = await createShare(app, "wx-a");
    const accept = await app.request(`/api/direct-shares/${share.share_id}/accept`, {
      method: "POST",
      headers: mockUserHeaders("wx-b"),
    });
    expect(accept.status).toBe(403);
    expect(await accept.json()).toEqual({ error: "请先绑定你的 AI 助手" });
  });

  it("不能和自己建联", async () => {
    await bindAgent(app, "wx-a", "Codex A");
    const share = await createShare(app, "wx-a");

    const accept = await app.request(`/api/direct-shares/${share.share_id}/accept`, {
      method: "POST",
      headers: mockUserHeaders("wx-a"),
    });
    expect(accept.status).toBe(409);
    expect(await accept.json()).toEqual({ error: "不能和自己建联" });
  });

  it("重复接受同一个分享应该返回同一条边", async () => {
    await bindAgent(app, "wx-a", "Codex A");
    await bindAgent(app, "wx-b", "Codex B");
    const share = await createShare(app, "wx-a");

    const first = await acceptShare(app, "wx-b", share.share_id);
    const second = await acceptShare(app, "wx-b", share.share_id);

    expect(second.edge_id).toBe(first.edge_id);
    const bEdges = await listEdges(app, "wx-b");
    expect(bEdges.edges).toHaveLength(1);
  });
});

async function bindAgent(app: Hono, wechatUserId: string, agentName: string) {
  const sessionRes = await app.request("/api/agent-bindings/sessions", {
    method: "POST",
    headers: mockUserHeaders(wechatUserId),
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
}

async function createShare(app: Hono, wechatUserId: string) {
  const res = await app.request("/api/direct-shares", {
    method: "POST",
    headers: mockUserHeaders(wechatUserId),
  });
  expect(res.status).toBe(201);
  return res.json() as Promise<{ share_id: string; share_path: string }>;
}

async function acceptShare(app: Hono, wechatUserId: string, shareId: string) {
  const res = await app.request(`/api/direct-shares/${shareId}/accept`, {
    method: "POST",
    headers: mockUserHeaders(wechatUserId),
  });
  expect([200, 201]).toContain(res.status);
  return res.json() as Promise<{ edge_id: string }>;
}

async function listEdges(app: Hono, wechatUserId: string) {
  const res = await app.request("/api/direct-edges", {
    headers: mockUserHeaders(wechatUserId),
  });
  expect(res.status).toBe(200);
  return res.json() as Promise<{ edges: Array<Record<string, unknown>> }>;
}

function mockUserHeaders(wechatUserId: string) {
  return { "X-Mock-Wechat-User-Id": wechatUserId };
}
