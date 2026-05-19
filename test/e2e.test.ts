import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, createEvent, joinEvent, getAttendees } from "./helpers.js";
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

  it("完整流程：创建活动 → 多人加入 → 获取列表 → 验证联系方式可见", async () => {
    const { res: createRes, data: event } = await createEvent(app, {
      name: "AI Builder Meetup",
      description: "AI 开发者聚会",
      location: "深圳南山",
      date: "2026-05-01",
    });
    expect(createRes.status).toBe(201);
    expect(event.event_id).toBeDefined();
    expect(event.invite_code).toBeDefined();

    const joinA = await joinEvent(app, {
      invite_code: event.invite_code,
      name: "Alice",
      profile: "Milvus 核心开发者，专注向量检索优化，5 年分布式系统经验",
      contact_info: "微信: alice_milvus",
    });
    expect(joinA.data.event_name).toBe("AI Builder Meetup");
    expect(joinA.data.registered_count).toBe(2);

    const joinB = await joinEvent(app, {
      invite_code: event.invite_code,
      name: "Bob",
      profile: "RAG 研究员，在做 RAG benchmark，发表过 3 篇相关论文",
      contact_info: "微信: bob_rag",
    });
    expect(joinB.data.registered_count).toBe(3);

    const joinC = await joinEvent(app, {
      invite_code: event.invite_code,
      name: "Charlie",
      profile: "AI 创业公司 CTO，在做 RAG as a Service",
      contact_info: "微信: charlie_vc",
    });
    expect(joinC.data.registered_count).toBe(4);

    const attendeesData = (await getAttendees(app, event.event_id)).data;
    expect(attendeesData.attendees).toHaveLength(4); // 主办方 + 3 参会者

    const contacts = attendeesData.attendees.map((a: any) => a.contact_info);
    expect(contacts).toContain("微信: alice_milvus");
    expect(contacts).toContain("微信: bob_rag");
    expect(contacts).toContain("微信: charlie_vc");

    const profiles = attendeesData.attendees.map((a: any) => a.profile);
    expect(profiles).toContain(
      "Milvus 核心开发者，专注向量检索优化，5 年分布式系统经验"
    );
  });

  it("跨活动身份：同一 token 加入不同活动", async () => {
    const event1 = (await createEvent(app, { name: "活动 A" })).data;
    const event2 = (await createEvent(app, { name: "活动 B" })).data;

    const join1 = (
      await joinEvent(app, {
        invite_code: event1.invite_code,
        name: "Hugo",
        profile: "画像 A",
        contact_info: "微信: hugo_ai",
      })
    ).data;
    const token = join1.user_token;

    const join2 = (
      await joinEvent(app, {
        invite_code: event2.invite_code,
        name: "Hugo",
        profile: "画像 B",
        contact_info: "微信: hugo_ai",
        user_token: token,
      })
    ).data;

    expect(join2.user_token).toBe(token);

    const a1 = (await getAttendees(app, event1.event_id)).data;
    expect(a1.attendees).toHaveLength(2);
    const hugoA = a1.attendees.find((x: any) => x.name === "Hugo");
    expect(hugoA.profile).toBe("画像 A");

    const a2 = (await getAttendees(app, event2.event_id)).data;
    expect(a2.attendees).toHaveLength(2);
    const hugoB = a2.attendees.find((x: any) => x.name === "Hugo");
    expect(hugoB.profile).toBe("画像 B");
  });

  it("GET /api/stats 应该返回活动和Agent数量", async () => {
    await createEvent(app, {
      name: "Test Event 1",
      description: "测试活动",
      location: "北京",
      date: "2026-06-01",
    });
    const event2 = (
      await createEvent(app, {
        name: "Test Event 2",
        description: "测试活动2",
        location: "上海",
        date: "2026-06-02",
      })
    ).data;
    await joinEvent(app, {
      invite_code: event2.invite_code,
      name: "Alice",
      contact_info: "alice@test.com",
      profile: "Engineer",
    });

    const res = await app.request("/api/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ events: 2, agents: 3 }); // 2 主办方 + 1 参会者
  });

  it("upsert 后参会者列表应该返回更新后的画像和联系方式", async () => {
    const event = (await createEvent(app, { name: "Upsert 测试" })).data;

    const join1 = (
      await joinEvent(app, {
        invite_code: event.invite_code,
        name: "Hugo",
        profile: "旧画像",
        contact_info: "旧联系方式",
      })
    ).data;

    await joinEvent(app, {
      invite_code: event.invite_code,
      name: "Hugo New",
      profile: "新画像",
      contact_info: "新联系方式",
      user_token: join1.user_token,
    });

    const attendees = (await getAttendees(app, event.event_id)).data;
    expect(attendees.attendees).toHaveLength(2); // 主办方 + Hugo
    const hugo = attendees.attendees.find((a: any) => a.name === "Hugo New");
    expect(hugo.profile).toBe("新画像");
    expect(hugo.contact_info).toBe("新联系方式");
  });
});
