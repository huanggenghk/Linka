# Join 落地页实施计划

**Goal:** 重做 `/join/:code` 落地页为粒子网络深色 UI + LIVE feed，并修改 `create_event` MCP tool 让主办方自动成为首个 Agent。

**Architecture:** 单文件视图模板 `src/views/join.ts` 渲染完整 HTML（内联 CSS + canvas JS）。`/join/:code` 路由读取 `events` 并 join `agents`+`users` 取最近 12 条 feed。`create_event` 在一次 SQL 事务里同时写 events + users + agents。

**Tech Stack:** Hono, Drizzle ORM, SQLite (better-sqlite3), vitest, 内联 canvas + DOM。

---

## File Structure

- **Modify**: `src/mcp/tools.ts` — `create_event` 新增 organizer_name/profile/contact 参数并自动 upsert users+agents
- **Create**: `src/views/join.ts` — 纯函数 `renderJoinPage(event, feed)` → HTML 字符串
- **Modify**: `src/app.ts` — `/join/:code` 查询 feed 数据并调用 `renderJoinPage`
- **Modify**: `test/mcp.test.ts`, `test/e2e.test.ts`, `test/join.test.ts` — 适配新签名，新增 organizer 自动加入断言

## Task 1: 扩展 `create_event` 自动加入主办方

**Files:**
- Modify: `src/mcp/tools.ts:15-72`
- Modify: `test/mcp.test.ts`, `test/e2e.test.ts`, `test/join.test.ts`

- [ ] **Step 1：在 `create_event` inputSchema 加 3 个必填字段**

文件 `src/mcp/tools.ts` 的 inputSchema 改为：

```ts
inputSchema: {
  name: z.string().describe("活动名称"),
  description: z.string().optional().describe("活动描述"),
  location: z.string().optional().describe("活动地点"),
  date: z.string().optional().describe("活动日期"),
  organizer_name: z.string().describe("主办方显示名（主办方自动成为首个 Agent）"),
  organizer_profile: z.string().describe("主办方的社交画像"),
  organizer_contact: z.string().describe("主办方联系方式"),
},
```

描述里加一段："主办方会自动加入活动作为首个 Agent。"

- [ ] **Step 2：handler 内同时插 users + agents**

替换 handler 函数体：

```ts
async ({ name, description, location, date, organizer_name, organizer_profile, organizer_contact }) => {
  const id = uuidv4();
  const inviteCode = generateInviteCode();
  const userId = uuidv4();
  const agentId = uuidv4();

  db.insert(events)
    .values({
      id,
      name,
      description: description || null,
      location: location || null,
      date: date || null,
      inviteCode,
    })
    .run();

  db.insert(users)
    .values({ id: userId, name: organizer_name, contactInfo: organizer_contact })
    .run();

  db.insert(agents)
    .values({ id: agentId, eventId: id, userId, profile: organizer_profile })
    .run();

  const joinUrl = `${BASE_URL}/join/${inviteCode}`;
  const cardPng = await generateInviteCard({ eventName: name, date: date ?? null, location: location ?? null, joinUrl });

  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ event_id: id, invite_code: inviteCode, join_url: joinUrl, organizer_token: userId }) },
      { type: "image" as const, data: cardPng.toString("base64"), mimeType: "image/png" },
    ],
  };
}
```

- [ ] **Step 3：批量更新测试调用 —— 给所有 `create_event` 调用加 organizer 字段**

在每个测试文件里，把所有 `callTool(app, "create_event", {...})` 调用扩展，把必需字段补齐。示例：

```ts
await callTool(app, "create_event", {
  name: "AI Builder Meetup",
  organizer_name: "主办方",
  organizer_profile: "活动发起人",
  organizer_contact: "organizer@example.com",
});
```

覆盖所有 3 个测试文件里的 create_event 调用点。

- [ ] **Step 4：在 `test/mcp.test.ts` 的 `create_event` describe 块里加一条新断言**

```ts
it("应该自动把主办方加入为首个 Agent", async () => {
  const res = await callTool(app, "create_event", {
    name: "自动加入测试",
    organizer_name: "Hugo",
    organizer_profile: "活动发起人，AI 工程师",
    organizer_contact: "微信: hugo_org",
  });
  const data = parseToolResult(res);

  const attendees = parseToolResult(
    await callTool(app, "get_attendees", { event_id: data.event_id })
  );
  expect(attendees.attendees).toHaveLength(1);
  expect(attendees.attendees[0].name).toBe("Hugo");
  expect(attendees.attendees[0].profile).toBe("活动发起人，AI 工程师");
  expect(attendees.attendees[0].contact_info).toBe("微信: hugo_org");
  expect(data.organizer_token).toBeDefined();
});
```

同时调整 `test/e2e.test.ts` 里 "完整流程：创建活动 → 多人加入..." 用例的 `expect(dataA.registered_count).toBe(1)` → `.toBe(2)`（因主办方已算 1），依次 `.toBe(3)`、`.toBe(4)`；末尾 `attendees.length` 从 3 改成 4。
同样调整 "GET /api/stats" 测试的 `agents: 1` → `agents: 3`（两个活动各 1 主办方 + 1 个后加入）。

- [ ] **Step 5：跑测试**

```bash
pnpm test
```

Expected: 全部通过。

- [ ] **Step 6：commit**

```bash
git add src/mcp/tools.ts test/
git commit -m "feat: auto-join organizer as first agent on create_event"
```

## Task 2: 新建 `src/views/join.ts` 渲染函数

**Files:**
- Create: `src/views/join.ts`

- [ ] **Step 1：创建文件骨架和数据类型**

```ts
export interface JoinPageEvent {
  name: string;
  date: string | null;
  location: string | null;
  host?: string | null;
}

export interface FeedEntry {
  name: string;
  profilePreview: string;
  joinedAt: string; // ISO timestamp
}

export interface JoinPageData {
  event: JoinPageEvent;
  activeCount: number;
  feed: FeedEntry[];
  joinUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} min 前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

export function renderJoinPage(data: JoinPageData): string {
  // implemented in next step
  throw new Error("not implemented");
}
```

- [ ] **Step 2：实现 `renderJoinPage` 函数主体**

把 demo `tmp/join-demo/index.html` 的 HTML/CSS/JS 平移过来，但：
- 删除顶栏 `.topbar` 和邀请元信息条 `.meta-strip`
- 活动标题从 data.event.name 注入（escape）
- DATE/LOC/HOST 三行根据是否有值条件渲染
- 活跃 Agent 数从 data.activeCount 注入
- FEED 条目用 data.feed 渲染（JS 端用 JSON.parse，或直接 SSR 静态条目）
- 把 `https://linka.zone/join/FNRQQ896` 替换成 data.joinUrl
- 全部用户注入内容经过 escapeHtml

SSR 方式：不用客户端 JS 注入 feed，直接服务端渲染 `.feed-row`，并复制一份（实现无缝 CSS 动画循环）。这样即使 JS 被禁用，feed 内容依然可读（动画不跑但数据在）。

Feed 长度 < 3 时视觉单薄；建议至少重复 3 次以撑满轨道。实现：`[...feed, ...feed, ...feed]` 直到至少 6 条，再复制一份用于循环。

完整实现跨 CSS (~260 行)、HTML 结构 (~80 行)、canvas + copy JS (~130 行)，总计 ~470 行。直接以 demo 为蓝本，不做大改。

- [ ] **Step 3：加 prefers-reduced-motion 分支**

CSS 块末尾加：

```css
@media (prefers-reduced-motion: reduce) {
  .feed-track { animation: none !important; }
  .live-count .num::after { animation: none !important; }
  .status .dot { animation: none !important; }
}
```

JS 层在粒子 requestAnimationFrame 循环开头判断：

```js
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

若为 true，粒子只画一帧静态图（执行一次 step 后不再 requestAnimationFrame）。

- [ ] **Step 4：commit**

```bash
git add src/views/
git commit -m "feat: add join landing page view template"
```

## Task 3: 在 `/join/:code` 路由里用新模板

**Files:**
- Modify: `src/app.ts:57-114`
- Modify: `test/join.test.ts`

- [ ] **Step 1：改 `/join/:code` handler**

替换 HTML 分支（保持 JSON 分支和 404 分支不变）：

```ts
if (accept.includes("text/html")) {
  const feedRows = database
    .select({
      name: schema.users.name,
      profile: schema.agents.profile,
      joinedAt: schema.agents.createdAt,
    })
    .from(schema.agents)
    .innerJoin(schema.users, eq(schema.agents.userId, schema.users.id))
    .where(eq(schema.agents.eventId, event.id))
    .orderBy(desc(schema.agents.createdAt))
    .limit(12)
    .all();

  const [{ value: activeCount }] = database
    .select({ value: count() })
    .from(schema.agents)
    .where(eq(schema.agents.eventId, event.id));

  const baseUrl = process.env.BASE_URL || "https://linka.zone";

  const html = renderJoinPage({
    event: { name: event.name, date: event.date, location: event.location, host: null },
    activeCount,
    feed: feedRows.map((r) => ({
      name: r.name,
      profilePreview: r.profile,
      joinedAt: r.joinedAt,
    })),
    joinUrl: `${baseUrl}/join/${event.inviteCode}`,
  });

  return c.html(html);
}
```

同时在文件顶部加 import：
```ts
import { desc } from "drizzle-orm";
import { renderJoinPage } from "./views/join.js";
```

（`count` 已经 import 过）

- [ ] **Step 2：更新 `test/join.test.ts` HTML 断言**

把 `expect(html).toContain("如何加入");` 改成：

```ts
expect(html).toContain("AI Builder Meetup");  // 活动名依然在
expect(html).toContain("加入网络");  // 新的 CTA 标签
expect(html).toContain("LIVE FEED");  // 新的 feed 标签
expect(html).toContain(`/join/${inviteCode}`);  // 链接依然在
```

移除 `expect(html).toContain(inviteCode);` —— 新模板不展示邀请码文字（仅在 URL 里）。保留 `expect(html).toContain("AI Builder Meetup");`。

- [ ] **Step 3：跑测试 + typecheck**

```bash
pnpm test && pnpm build
```

Expected: 全部通过，无 TS 错误。

- [ ] **Step 4：commit**

```bash
git add src/app.ts src/views/ test/join.test.ts
git commit -m "feat: wire new landing page template into /join/:code"
```

## Task 4: 收尾（清理 demo、更新 CHANGELOG 和 VERSION）

- [ ] **Step 1：清理 tmp/join-demo**

```bash
rm -rf tmp/join-demo
rmdir tmp 2>/dev/null || true
```

- [ ] **Step 2：更新 CHANGELOG.md 和 VERSION**

在 CHANGELOG.md 顶部加：

```
## v1.1.0 — 2026-04-22
- feat: 邀请落地页全新设计（深色粒子网络 + LIVE feed 动态流）
- feat: create_event 自动把主办方加为首个 Agent（新增必填参数 organizer_name/profile/contact）
- break: create_event 的旧调用方式失效，调用方需补齐 organizer 字段
```

VERSION 从当前值升到 `1.1.0`。

- [ ] **Step 3：commit**

```bash
git add CHANGELOG.md VERSION tmp/
git commit -m "chore: bump to v1.1.0, remove demo scratch"
```
