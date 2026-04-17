import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, callTool, parseToolResult } from "./helpers.js";
import type { Hono } from "hono";

describe("QR 码加入流程", () => {
  let app: Hono;
  let inviteCode: string;
  let eventId: string;

  beforeEach(async () => {
    const env = createTestApp();
    app = env.app;

    const res = await callTool(app, "create_event", {
      name: "AI Builder Meetup",
      description: "AI 开发者聚会",
      location: "深圳南山",
      date: "2026-05-01",
    });
    const data = parseToolResult(res);
    inviteCode = data.invite_code;
    eventId = data.event_id;
  });

  describe("create_event 返回值", () => {
    it("应该返回 qr_code 和 join_url", async () => {
      const res = await callTool(app, "create_event", {
        name: "测试活动",
      });
      const data = parseToolResult(res);

      expect(data.event_id).toBeDefined();
      expect(data.invite_code).toBeDefined();
      expect(data.join_url).toBeDefined();
      expect(data.qr_code).toBeDefined();

      // join_url 格式正确
      expect(data.join_url).toContain(`/join/${data.invite_code}`);

      // qr_code 是 base64 data URL
      expect(data.qr_code).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe("GET /join/:code — JSON (默认)", () => {
    it("应该返回活动 JSON 信息", async () => {
      const res = await app.request(`/join/${inviteCode}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.event_name).toBe("AI Builder Meetup");
      expect(data.description).toBe("AI 开发者聚会");
      expect(data.location).toBe("深圳南山");
      expect(data.date).toBe("2026-05-01");
      expect(data.invite_code).toBe(inviteCode);
    });

    it("无效邀请码应该返回 404 JSON", async () => {
      const res = await app.request("/join/INVALID0");
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe("活动不存在");
    });
  });

  describe("GET /join/:code — HTML (Accept: text/html)", () => {
    it("应该返回 HTML 活动信息页", async () => {
      const res = await app.request(`/join/${inviteCode}`, {
        headers: { Accept: "text/html" },
      });
      expect(res.status).toBe(200);

      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("AI Builder Meetup");
      expect(html).toContain(inviteCode);
      expect(html).toContain("如何加入");
    });

    it("无效邀请码应该返回 404 HTML", async () => {
      const res = await app.request("/join/INVALID0", {
        headers: { Accept: "text/html" },
      });
      expect(res.status).toBe(404);

      const html = await res.text();
      expect(html).toContain("活动不存在");
    });
  });

  describe("E2E：完整 QR 加入流程", () => {
    it("创建活动 → 获取 QR 信息 → 查询活动 → 用 invite_code 加入", async () => {
      // 1. 组织者创建活动，拿到 QR 码信息
      const createRes = await callTool(app, "create_event", {
        name: "QR 测试活动",
        description: "测试完整 QR 加入流程",
        location: "北京",
        date: "2026-06-01",
      });
      const createData = parseToolResult(createRes);
      expect(createData.join_url).toBeDefined();
      expect(createData.qr_code).toBeDefined();

      // 2. 参与者 Agent 从 join_url 解析出 invite_code，访问 /join/:code
      const code = createData.invite_code;
      const joinPageRes = await app.request(`/join/${code}`);
      expect(joinPageRes.status).toBe(200);

      const eventInfo = await joinPageRes.json();
      expect(eventInfo.event_name).toBe("QR 测试活动");
      expect(eventInfo.invite_code).toBe(code);

      // 3. 参与者 Agent 用 invite_code 调用 join_event
      const joinRes = await callTool(app, "join_event", {
        invite_code: eventInfo.invite_code,
        name: "参与者",
        profile: "通过 QR 码加入的用户",
        contact_info: "微信: test_qr",
      });
      const joinData = parseToolResult(joinRes);
      expect(joinData.event_name).toBe("QR 测试活动");
      expect(joinData.registered_count).toBe(1);

      // 4. 验证参会者列表
      const attendeesRes = await callTool(app, "get_attendees", {
        event_id: createData.event_id,
      });
      const attendeesData = parseToolResult(attendeesRes);
      expect(attendeesData.attendees).toHaveLength(1);
      expect(attendeesData.attendees[0].name).toBe("参与者");
      expect(attendeesData.attendees[0].contact_info).toBe("微信: test_qr");
    });
  });
});
