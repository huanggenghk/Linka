import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, createEvent, joinEvent, getAttendees } from "./helpers.js";
import type { Hono } from "hono";

describe("Activity Event REST API", () => {
  let app: Hono;

  beforeEach(() => {
    const env = createTestApp();
    app = env.app;
  });

  describe("POST /api/events", () => {
    it("应该创建活动并返回 event_id 和 invite_code", async () => {
      const { res, data } = await createEvent(app, {
        name: "AI Meetup",
        description: "AI 开发者聚会",
        location: "深圳",
        date: "2026-05-01",
      });

      expect(res.status).toBe(201);
      expect(data.event_id).toBeDefined();
      expect(data.invite_code).toBeDefined();
      expect(data.invite_code).toHaveLength(8);
    });

    it("应该在只传必填字段时也能创建活动", async () => {
      const { res, data } = await createEvent(app, { name: "简单活动" });

      expect(res.status).toBe(201);
      expect(data.event_id).toBeDefined();
      expect(data.invite_code).toBeDefined();
    });

    it("每次创建活动应该生成不同的邀请码", async () => {
      const first = await createEvent(app, { name: "活动1" });
      const second = await createEvent(app, { name: "活动2" });

      expect(first.data.invite_code).not.toBe(second.data.invite_code);
    });

    it("应该自动把主办方加入为首个 Agent", async () => {
      const { data } = await createEvent(app, {
        name: "自动加入测试",
        organizer_name: "Hugo",
        organizer_profile: "活动发起人，AI 工程师",
        organizer_contact: "微信: hugo_org",
      });

      expect(data.organizer_token).toBeDefined();

      const attendees = await getAttendees(app, data.event_id);
      expect(attendees.res.status).toBe(200);
      expect(attendees.data.attendees).toHaveLength(1);
      expect(attendees.data.attendees[0].name).toBe("Hugo");
      expect(attendees.data.attendees[0].profile).toBe("活动发起人，AI 工程师");
      expect(attendees.data.attendees[0].contact_info).toBe("微信: hugo_org");
    });

    it("参数不完整应该返回 400", async () => {
      const res = await app.request("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "缺少主办方" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "请求参数无效" });
    });
  });

  describe("POST /api/events/join", () => {
    let inviteCode: string;
    let eventId: string;

    beforeEach(async () => {
      const { data } = await createEvent(app, { name: "测试活动" });
      inviteCode = data.invite_code;
      eventId = data.event_id;
    });

    it("应该成功加入活动（新用户）", async () => {
      const { res, data } = await joinEvent(app, {
        invite_code: inviteCode,
        name: "Hugo",
        profile: "AI 工程师，专注 RAG 管道优化",
        contact_info: "微信: hugo_ai",
      });

      expect(res.status).toBe(200);
      expect(data.event_id).toBe(eventId);
      expect(data.event_name).toBe("测试活动");
      expect(data.agent_id).toBeDefined();
      expect(data.user_token).toBeDefined();
      expect(data.registered_count).toBe(2);
    });

    it("无效邀请码应该返回错误", async () => {
      const { res, data } = await joinEvent(app, {
        invite_code: "INVALID",
        name: "Hugo",
        profile: "test",
        contact_info: "test",
      });

      expect(res.status).toBe(404);
      expect(data.error).toBe("无效的邀请码");
    });

    it("已有 user_token 应该关联到同一用户", async () => {
      const firstJoin = await joinEvent(app, {
        invite_code: inviteCode,
        name: "Hugo",
        profile: "v1 画像",
        contact_info: "微信: hugo_ai",
      });
      const token = firstJoin.data.user_token;

      const secondEvent = await createEvent(app, { name: "活动2" });
      const secondJoin = await joinEvent(app, {
        invite_code: secondEvent.data.invite_code,
        name: "Hugo",
        profile: "v2 画像",
        contact_info: "微信: hugo_ai",
        user_token: token,
      });

      expect(secondJoin.data.user_token).toBe(token);
      expect(secondJoin.data.event_id).toBe(secondEvent.data.event_id);
    });

    it("重复加入同一活动应该更新画像（upsert）", async () => {
      const firstJoin = await joinEvent(app, {
        invite_code: inviteCode,
        name: "Hugo",
        profile: "旧画像",
        contact_info: "微信: hugo_ai",
      });
      expect(firstJoin.data.registered_count).toBe(2);

      const secondJoin = await joinEvent(app, {
        invite_code: inviteCode,
        name: "Hugo Updated",
        profile: "新画像",
        contact_info: "微信: hugo_new",
        user_token: firstJoin.data.user_token,
      });

      expect(secondJoin.data.registered_count).toBe(2);
      expect(secondJoin.data.agent_id).toBe(firstJoin.data.agent_id);
    });

    it("多个用户加入应该正确计数", async () => {
      await joinEvent(app, {
        invite_code: inviteCode,
        name: "User1",
        profile: "profile1",
        contact_info: "contact1",
      });

      const { data } = await joinEvent(app, {
        invite_code: inviteCode,
        name: "User2",
        profile: "profile2",
        contact_info: "contact2",
      });

      expect(data.registered_count).toBe(3);
    });

    it("无效 user_token 应该创建新用户（使用该 token 作为 ID）", async () => {
      const fakeToken = "fake-token-12345";
      const { data } = await joinEvent(app, {
        invite_code: inviteCode,
        name: "New User",
        profile: "profile",
        contact_info: "contact",
        user_token: fakeToken,
      });

      expect(data.user_token).toBe(fakeToken);
    });
  });

  describe("GET /api/events/:eventId/attendees", () => {
    let inviteCode: string;
    let eventId: string;

    beforeEach(async () => {
      const { data } = await createEvent(app, { name: "聚会" });
      inviteCode = data.invite_code;
      eventId = data.event_id;
    });

    it("无效 event_id 应该返回错误", async () => {
      const { res, data } = await getAttendees(app, "nonexistent");

      expect(res.status).toBe(404);
      expect(data.error).toBe("活动不存在");
    });

    it("新活动应该至少包含主办方", async () => {
      const { res, data } = await getAttendees(app, eventId);

      expect(res.status).toBe(200);
      expect(data.attendees).toHaveLength(1);
      expect(data.attendees[0].name).toBe("主办方");
    });

    it("应该返回所有参会者及其联系方式", async () => {
      await joinEvent(app, {
        invite_code: inviteCode,
        name: "Alice",
        profile: "AI 研究员",
        contact_info: "微信: alice_ai",
      });
      await joinEvent(app, {
        invite_code: inviteCode,
        name: "Bob",
        profile: "后端工程师",
        contact_info: "微信: bob_dev",
      });

      const { data } = await getAttendees(app, eventId);
      expect(data.attendees).toHaveLength(3);

      const names = data.attendees.map((a: any) => a.name);
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
      expect(names).toContain("主办方");

      const alice = data.attendees.find((a: any) => a.name === "Alice");
      expect(alice.profile).toBe("AI 研究员");
      expect(alice.contact_info).toBe("微信: alice_ai");
      expect(alice.agent_id).toBeDefined();
    });
  });
});
