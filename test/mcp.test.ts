import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, callTool, parseToolResult, isToolError, createEventArgs } from "./helpers.js";
import type { Hono } from "hono";

describe("MCP Tools", () => {
  let app: Hono;

  beforeEach(() => {
    const env = createTestApp();
    app = env.app;
  });

  describe("create_event", () => {
    it("应该创建活动并返回 event_id 和 invite_code", async () => {
      const res = await callTool(app, "create_event", createEventArgs({
        name: "AI Meetup",
        description: "AI 开发者聚会",
        location: "深圳",
        date: "2026-05-01",
      }));

      const data = parseToolResult(res);
      expect(data.event_id).toBeDefined();
      expect(data.invite_code).toBeDefined();
      expect(data.invite_code).toHaveLength(8);
    });

    it("应该在只传必填字段时也能创建活动", async () => {
      const res = await callTool(app, "create_event", createEventArgs({
        name: "简单活动",
      }));

      const data = parseToolResult(res);
      expect(data.event_id).toBeDefined();
      expect(data.invite_code).toBeDefined();
    });

    it("每次创建活动应该生成不同的邀请码", async () => {
      const res1 = await callTool(app, "create_event", createEventArgs({ name: "活动1" }));
      const res2 = await callTool(app, "create_event", createEventArgs({ name: "活动2" }));

      const data1 = parseToolResult(res1);
      const data2 = parseToolResult(res2);
      expect(data1.invite_code).not.toBe(data2.invite_code);
    });

    it("应该自动把主办方加入为首个 Agent", async () => {
      const res = await callTool(app, "create_event", {
        name: "自动加入测试",
        organizer_name: "Hugo",
        organizer_profile: "活动发起人，AI 工程师",
        organizer_contact: "微信: hugo_org",
      });
      const data = parseToolResult(res);
      expect(data.organizer_token).toBeDefined();

      const attendeesRes = await callTool(app, "get_attendees", {
        event_id: data.event_id,
      });
      const attendees = parseToolResult(attendeesRes);
      expect(attendees.attendees).toHaveLength(1);
      expect(attendees.attendees[0].name).toBe("Hugo");
      expect(attendees.attendees[0].profile).toBe("活动发起人，AI 工程师");
      expect(attendees.attendees[0].contact_info).toBe("微信: hugo_org");
    });
  });

  describe("join_event", () => {
    let inviteCode: string;
    let eventId: string;

    beforeEach(async () => {
      const res = await callTool(app, "create_event", createEventArgs({
        name: "测试活动",
      }));
      const data = parseToolResult(res);
      inviteCode = data.invite_code;
      eventId = data.event_id;
    });

    it("应该成功加入活动（新用户）", async () => {
      const res = await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "Hugo",
        profile: "AI 工程师，专注 RAG 管道优化",
        contact_info: "微信: hugo_ai",
      });

      const data = parseToolResult(res);
      expect(data.event_id).toBe(eventId);
      expect(data.event_name).toBe("测试活动");
      expect(data.agent_id).toBeDefined();
      expect(data.user_token).toBeDefined();
      expect(data.registered_count).toBe(2); // 主办方 + 新加入用户
    });

    it("无效邀请码应该返回错误", async () => {
      const res = await callTool(app, "join_event", {
        invite_code: "INVALID",
        name: "Hugo",
        profile: "test",
        contact_info: "test",
      });

      expect(isToolError(res)).toBe(true);
      const data = parseToolResult(res);
      expect(data.error).toBe("无效的邀请码");
    });

    it("已有 user_token 应该关联到同一用户", async () => {
      // 第一次加入
      const res1 = await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "Hugo",
        profile: "v1 画像",
        contact_info: "微信: hugo_ai",
      });
      const data1 = parseToolResult(res1);
      const token = data1.user_token;

      // 创建第二个活动
      const res2 = await callTool(app, "create_event", createEventArgs({ name: "活动2" }));
      const event2 = parseToolResult(res2);

      // 用 token 加入第二个活动
      const res3 = await callTool(app, "join_event", {
        invite_code: event2.invite_code,
        name: "Hugo",
        profile: "v2 画像",
        contact_info: "微信: hugo_ai",
        user_token: token,
      });
      const data3 = parseToolResult(res3);

      expect(data3.user_token).toBe(token);
      expect(data3.event_id).toBe(event2.event_id);
    });

    it("重复加入同一活动应该更新画像（upsert）", async () => {
      // 第一次加入
      const res1 = await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "Hugo",
        profile: "旧画像",
        contact_info: "微信: hugo_ai",
      });
      const data1 = parseToolResult(res1);
      expect(data1.registered_count).toBe(2); // 主办方 + Hugo

      // 用同一 token 再次加入
      const res2 = await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "Hugo Updated",
        profile: "新画像",
        contact_info: "微信: hugo_new",
        user_token: data1.user_token,
      });
      const data2 = parseToolResult(res2);

      expect(data2.registered_count).toBe(2); // 依然是 2 个人，upsert 不新增
      expect(data2.agent_id).toBe(data1.agent_id); // 同一个 agent
    });

    it("多个用户加入应该正确计数", async () => {
      await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "User1",
        profile: "profile1",
        contact_info: "contact1",
      });

      const res = await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "User2",
        profile: "profile2",
        contact_info: "contact2",
      });

      const data = parseToolResult(res);
      expect(data.registered_count).toBe(3); // 主办方 + User1 + User2
    });

    it("无效 user_token 应该创建新用户（使用该 token 作为 ID）", async () => {
      const fakeToken = "fake-token-12345";
      const res = await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "New User",
        profile: "profile",
        contact_info: "contact",
        user_token: fakeToken,
      });

      const data = parseToolResult(res);
      expect(data.user_token).toBe(fakeToken);
    });
  });

  describe("get_attendees", () => {
    let inviteCode: string;
    let eventId: string;

    beforeEach(async () => {
      const res = await callTool(app, "create_event", createEventArgs({ name: "聚会" }));
      const data = parseToolResult(res);
      inviteCode = data.invite_code;
      eventId = data.event_id;
    });

    it("无效 event_id 应该返回错误", async () => {
      const res = await callTool(app, "get_attendees", {
        event_id: "nonexistent",
      });

      expect(isToolError(res)).toBe(true);
      const data = parseToolResult(res);
      expect(data.error).toBe("活动不存在");
    });

    it("新活动应该至少包含主办方", async () => {
      const res = await callTool(app, "get_attendees", {
        event_id: eventId,
      });

      const data = parseToolResult(res);
      expect(data.attendees).toHaveLength(1);
      expect(data.attendees[0].name).toBe("主办方");
    });

    it("应该返回所有参会者及其联系方式", async () => {
      // 注册两个用户
      await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "Alice",
        profile: "AI 研究员",
        contact_info: "微信: alice_ai",
      });
      await callTool(app, "join_event", {
        invite_code: inviteCode,
        name: "Bob",
        profile: "后端工程师",
        contact_info: "微信: bob_dev",
      });

      const res = await callTool(app, "get_attendees", {
        event_id: eventId,
      });

      const data = parseToolResult(res);
      expect(data.attendees).toHaveLength(3); // 主办方 + Alice + Bob

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
