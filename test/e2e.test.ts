import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp } from "./helpers.js";
import type { Hono } from "hono";

describe("E2E 完整流程", () => {
  let app: Hono;

  beforeEach(() => {
    const env = createTestApp();
    app = env.app;
  });

  it("健康检查应该返回 ok", async () => {
    const res = await app.request("/health");
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("活动 REST API 应该已退役", async () => {
    const createRes = await app.request("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "已退役活动" }),
    });
    expect(createRes.status).toBe(404);

    const joinRes = await app.request("/api/events/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "INVALID" }),
    });
    expect(joinRes.status).toBe(404);

    const attendeesRes = await app.request("/api/events/event-1/attendees");
    expect(attendeesRes.status).toBe(404);
  });

  it("旧活动兼容入口应该已彻底移除", async () => {
    const statsRes = await app.request("/api/stats");
    expect(statsRes.status).toBe(404);

    const joinJsonRes = await app.request("/join/OLD12345");
    expect(joinJsonRes.status).toBe(404);

    const joinHtmlRes = await app.request("/join/OLD12345", {
      headers: { Accept: "text/html" },
    });
    expect(joinHtmlRes.status).toBe(404);

    const cardRes = await app.request("/card/OLD12345.png");
    expect(cardRes.status).toBe(404);
  });
});
