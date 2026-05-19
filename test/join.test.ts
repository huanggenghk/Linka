import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, createEvent, joinEvent, getAttendees } from "./helpers.js";
import type { Hono } from "hono";

describe("QR 码加入流程", () => {
  let app: Hono;
  let inviteCode: string;
  let eventId: string;

  beforeEach(async () => {
    const env = createTestApp();
    app = env.app;

    const { data } = await createEvent(app, {
      name: "AI Builder Meetup",
      description: "AI 开发者聚会",
      location: "深圳南山",
      date: "2026-05-01",
    });
    inviteCode = data.invite_code;
    eventId = data.event_id;
  });

  describe("POST /api/events 返回值", () => {
    it("应该返回 invite_code、join_url 和 card_url", async () => {
      const { res, data } = await createEvent(app, {
        name: "测试活动",
      });

      expect(res.status).toBe(201);
      expect(data.event_id).toBeDefined();
      expect(data.invite_code).toBeDefined();
      expect(data.join_url).toBeDefined();
      expect(data.card_url).toBeDefined();

      // join_url / card_url 格式正确
      expect(data.join_url).toContain(`/join/${data.invite_code}`);
      expect(data.card_url).toContain(`/card/${data.invite_code}.png`);
    });
  });

  describe("GET /card/:code.png", () => {
    it("应该返回 PNG 图片字节流", async () => {
      const res = await app.request(`/card/${inviteCode}.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toContain("max-age");

      const buf = new Uint8Array(await res.arrayBuffer());
      // PNG magic bytes: 89 50 4E 47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
    });

    it("无效邀请码应该返回 404", async () => {
      const res = await app.request("/card/INVALID0.png");
      expect(res.status).toBe(404);
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
      expect(html).toContain("AI Builder Meetup"); // 活动名
      expect(html).toContain("加入网络"); // CTA 标签
      expect(html).toContain("LIVE FEED"); // 动态流标签
      expect(html).toContain(`/join/${inviteCode}`); // 完整邀请链接在 COPY 框内
      expect(html).toContain("主办方"); // 默认 organizer 出现在 feed 中
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
      const { data: createData } = await createEvent(app, {
        name: "QR 测试活动",
        description: "测试完整 QR 加入流程",
        location: "北京",
        date: "2026-06-01",
      });
      expect(createData.join_url).toBeDefined();

      const code = createData.invite_code;
      const joinPageRes = await app.request(`/join/${code}`);
      expect(joinPageRes.status).toBe(200);

      const eventInfo = await joinPageRes.json();
      expect(eventInfo.event_name).toBe("QR 测试活动");
      expect(eventInfo.invite_code).toBe(code);

      const { data: joinData } = await joinEvent(app, {
        invite_code: eventInfo.invite_code,
        name: "参与者",
        profile: "通过 QR 码加入的用户",
        contact_info: "微信: test_qr",
      });
      expect(joinData.event_name).toBe("QR 测试活动");
      expect(joinData.registered_count).toBe(2); // 主办方 + 参与者

      const { data: attendeesData } = await getAttendees(app, createData.event_id);
      expect(attendeesData.attendees).toHaveLength(2);
      const participant = attendeesData.attendees.find((a: any) => a.name === "参与者");
      expect(participant.contact_info).toBe("微信: test_qr");
    });
  });
});
