import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestApp,
  seedLegacyAttendee,
  seedLegacyEvent,
} from "./helpers.js";
import type { Hono } from "hono";

describe("E2E 完整流程", () => {
  let env: ReturnType<typeof createTestApp>;
  let app: Hono;

  beforeEach(() => {
    env = createTestApp();
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

  it("GET /api/stats 应该返回活动和Agent数量", async () => {
    seedLegacyEvent(env.db, {
      name: "Test Event 1",
      description: "测试活动",
      location: "北京",
      date: "2026-06-01",
    });
    const secondEvent = seedLegacyEvent(env.db, {
      name: "Test Event 2",
      description: "测试活动2",
      location: "上海",
      date: "2026-06-02",
    });
    seedLegacyAttendee(env.db, {
      eventId: secondEvent.eventId,
      name: "Alice",
      profile: "Engineer",
      contactInfo: "alice@test.com",
    });

    const res = await app.request("/api/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ events: 2, agents: 3 }); // 2 主办方 + 1 参会者
  });
});
