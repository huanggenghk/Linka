import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, callTool, parseToolResult, mcpRequest, createEventArgs } from "./helpers.js";
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

  it("tools/list 应该返回 3 个工具", async () => {
    const res = await mcpRequest(app, "tools/list");
    const tools = res.result?.tools;
    expect(tools).toHaveLength(3);

    const names = tools.map((t: any) => t.name);
    expect(names).toContain("create_event");
    expect(names).toContain("join_event");
    expect(names).toContain("get_attendees");
  });

  it("完整流程：创建活动 → 多人加入 → 获取列表 → 验证联系方式可见", async () => {
    // 1. 主办方创建活动（自动加入为首个 Agent）
    const createRes = await callTool(app, "create_event", createEventArgs({
      name: "AI Builder Meetup",
      description: "AI 开发者聚会",
      location: "深圳南山",
      date: "2026-05-01",
    }));
    const event = parseToolResult(createRes);
    expect(event.event_id).toBeDefined();
    expect(event.invite_code).toBeDefined();

    // 2. 参会者 A 加入
    const joinA = await callTool(app, "join_event", {
      invite_code: event.invite_code,
      name: "Alice",
      profile: "Milvus 核心开发者，专注向量检索优化，5 年分布式系统经验",
      contact_info: "微信: alice_milvus",
    });
    const dataA = parseToolResult(joinA);
    expect(dataA.event_name).toBe("AI Builder Meetup");
    expect(dataA.registered_count).toBe(2); // 主办方 + Alice

    // 3. 参会者 B 加入
    const joinB = await callTool(app, "join_event", {
      invite_code: event.invite_code,
      name: "Bob",
      profile: "RAG 研究员，在做 RAG benchmark，发表过 3 篇相关论文",
      contact_info: "微信: bob_rag",
    });
    const dataB = parseToolResult(joinB);
    expect(dataB.registered_count).toBe(3);

    // 4. 参会者 C 加入
    const joinC = await callTool(app, "join_event", {
      invite_code: event.invite_code,
      name: "Charlie",
      profile: "AI 创业公司 CTO，在做 RAG as a Service",
      contact_info: "微信: charlie_vc",
    });
    const dataC = parseToolResult(joinC);
    expect(dataC.registered_count).toBe(4);

    // 5. 获取参会者列表
    const attendeesRes = await callTool(app, "get_attendees", {
      event_id: event.event_id,
    });
    const attendeesData = parseToolResult(attendeesRes);
    expect(attendeesData.attendees).toHaveLength(4); // 主办方 + 3 参会者

    // 6. 验证所有人的联系方式可见
    const contacts = attendeesData.attendees.map((a: any) => a.contact_info);
    expect(contacts).toContain("微信: alice_milvus");
    expect(contacts).toContain("微信: bob_rag");
    expect(contacts).toContain("微信: charlie_vc");

    // 7. 验证画像可见
    const profiles = attendeesData.attendees.map((a: any) => a.profile);
    expect(profiles).toContain(
      "Milvus 核心开发者，专注向量检索优化，5 年分布式系统经验"
    );
  });

  it("跨活动身份：同一 token 加入不同活动", async () => {
    // 创建两个活动（每个活动自动有 1 个主办方）
    const event1 = parseToolResult(
      await callTool(app, "create_event", createEventArgs({ name: "活动 A" }))
    );
    const event2 = parseToolResult(
      await callTool(app, "create_event", createEventArgs({ name: "活动 B" }))
    );

    // 用户加入活动 A
    const join1 = parseToolResult(
      await callTool(app, "join_event", {
        invite_code: event1.invite_code,
        name: "Hugo",
        profile: "画像 A",
        contact_info: "微信: hugo_ai",
      })
    );
    const token = join1.user_token;

    // 同一用户加入活动 B
    const join2 = parseToolResult(
      await callTool(app, "join_event", {
        invite_code: event2.invite_code,
        name: "Hugo",
        profile: "画像 B",
        contact_info: "微信: hugo_ai",
        user_token: token,
      })
    );

    // token 应该一致
    expect(join2.user_token).toBe(token);

    // 活动 A 有 2 人（主办方 + Hugo）
    const a1 = parseToolResult(
      await callTool(app, "get_attendees", { event_id: event1.event_id })
    );
    expect(a1.attendees).toHaveLength(2);
    const hugoA = a1.attendees.find((x: any) => x.name === "Hugo");
    expect(hugoA.profile).toBe("画像 A");

    // 活动 B 有 2 人
    const a2 = parseToolResult(
      await callTool(app, "get_attendees", { event_id: event2.event_id })
    );
    expect(a2.attendees).toHaveLength(2);
    const hugoB = a2.attendees.find((x: any) => x.name === "Hugo");
    expect(hugoB.profile).toBe("画像 B");
  });

  it("GET /api/stats 应该返回活动和Agent数量", async () => {
    // 先创建一些测试数据（每个活动自动生成 1 个主办方 Agent）
    await callTool(app, "create_event", createEventArgs({
      name: "Test Event 1",
      description: "测试活动",
      location: "北京",
      date: "2026-06-01",
    }));
    const event2 = parseToolResult(
      await callTool(app, "create_event", createEventArgs({
        name: "Test Event 2",
        description: "测试活动2",
        location: "上海",
        date: "2026-06-02",
      }))
    );
    // 再加入一个参会者
    await callTool(app, "join_event", {
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

  it("upsert 后 get_attendees 应该返回更新后的画像和联系方式", async () => {
    const event = parseToolResult(
      await callTool(app, "create_event", createEventArgs({ name: "Upsert 测试" }))
    );

    // 首次加入
    const join1 = parseToolResult(
      await callTool(app, "join_event", {
        invite_code: event.invite_code,
        name: "Hugo",
        profile: "旧画像",
        contact_info: "旧联系方式",
      })
    );

    // 更新画像（upsert）
    await callTool(app, "join_event", {
      invite_code: event.invite_code,
      name: "Hugo New",
      profile: "新画像",
      contact_info: "新联系方式",
      user_token: join1.user_token,
    });

    // 验证更新
    const attendees = parseToolResult(
      await callTool(app, "get_attendees", { event_id: event.event_id })
    );
    expect(attendees.attendees).toHaveLength(2); // 主办方 + Hugo
    const hugo = attendees.attendees.find((a: any) => a.name === "Hugo New");
    expect(hugo.profile).toBe("新画像");
    expect(hugo.contact_info).toBe("新联系方式");
  });
});
