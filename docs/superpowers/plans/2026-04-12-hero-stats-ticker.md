# Hero Stats + Ticker 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Hero 区域底部新增实时统计指示器（活动数 + Agent 数）和人脉信息滚动条。

**Architecture:** 后端新增 `GET /api/stats` 路由返回 count 数据，前端在 Hero 组件中新增统计行和 CSS 纯动画 ticker。

**Tech Stack:** Hono (backend route), Drizzle ORM (count query), React (component), CSS keyframes (ticker animation)

---

### Task 1: 后端 — 新增 `/api/stats` endpoint

**Files:**
- Modify: `src/app.ts:41` (在 `/health` 路由后新增)
- Test: `test/e2e.test.ts` (新增测试用例)

- [ ] **Step 1: 写失败测试**

在 `test/e2e.test.ts` 的 describe 块末尾新增：

```typescript
it("GET /api/stats 应该返回活动和Agent数量", async () => {
  // 先创建一些测试数据
  await callTool(app, "create_event", {
    name: "Test Event 1",
    description: "测试活动",
    location: "北京",
    date: "2026-06-01",
  });
  const event2 = parseToolResult(
    await callTool(app, "create_event", {
      name: "Test Event 2",
      description: "测试活动2",
      location: "上海",
      date: "2026-06-02",
    })
  );
  // 加入一个活动以创建 agent
  await callTool(app, "join_event", {
    invite_code: event2.invite_code,
    name: "Alice",
    contact_info: "alice@test.com",
    profile: "Engineer",
  });

  const res = await app.request("/api/stats");
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual({ events: 2, agents: 1 });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm test`
Expected: FAIL — `/api/stats` 返回 404

- [ ] **Step 3: 实现 `/api/stats` 路由**

在 `src/app.ts` 中，在 `app.get("/health", ...)` 之后、`app.all("/mcp", ...)` 之前，新增：

```typescript
import { count } from "drizzle-orm";
import * as schema from "./db/schema.js";
```

将 import 加到文件顶部，然后在路由部分新增：

```typescript
app.get("/api/stats", async (c) => {
  const [eventsResult] = await database
    .select({ value: count() })
    .from(schema.events);
  const [agentsResult] = await database
    .select({ value: count() })
    .from(schema.agents);
  return c.json({
    events: eventsResult.value,
    agents: agentsResult.value,
  });
});
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add src/app.ts test/e2e.test.ts
git commit -m "feat: add GET /api/stats endpoint for event and agent counts"
```

---

### Task 2: 前端 — CSS 样式（脉冲绿点 + Ticker 滚动）

**Files:**
- Modify: `web/src/App.css` (在 `.hero-helper` 样式后新增)

- [ ] **Step 1: 新增脉冲绿点和统计指示器样式**

在 `web/src/App.css` 的 `.hero-helper` 规则之后、`/* ========== Showcase ==========*/` 之前，新增：

```css
/* ========== Hero Stats ========== */
.hero-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
}

.hero-stat-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ========== Hero Ticker ========== */
.hero-ticker {
  margin-top: 24px;
  overflow: hidden;
  width: 100%;
  mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
}

.hero-ticker-track {
  display: flex;
  gap: 12px;
  width: max-content;
  animation: ticker-scroll 35s linear infinite;
}

.hero-ticker-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.hero-ticker-name {
  font-weight: 600;
  color: var(--text);
}

.hero-ticker-sep {
  color: var(--border-hover);
}

@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

- [ ] **Step 2: 新增响应式样式**

在 `@media (max-width: 768px)` 块内新增：

```css
.hero-ticker-card {
  font-size: 12px;
  padding: 5px 12px;
}
```

- [ ] **Step 3: 提交**

```bash
git add web/src/App.css
git commit -m "style: add hero stats pulse dot and ticker scroll CSS"
```

---

### Task 3: 前端 — Hero 组件增加统计和 Ticker

**Files:**
- Modify: `web/src/components/Hero.tsx`

- [ ] **Step 1: 重写 Hero.tsx**

将 `web/src/components/Hero.tsx` 完整替换为：

```tsx
import { useState, useEffect } from 'react'

const TICKER_DATA = [
  { name: 'Kira', org: 'Moonshot AI', focus: '关注多模态落地，寻找产品端合作伙伴' },
  { name: 'Vincent', org: '红杉中国', focus: '关注AI Infra赛道，寻找种子轮项目' },
  { name: '0xNova', org: '字节跳动', focus: '关注端侧推理优化，寻找算法方向交流' },
  { name: 'Mia', org: '智谱AI', focus: '关注Agent框架设计，寻找开源社区贡献者' },
  { name: 'hyperZ', org: '阿里云', focus: '关注Serverless AI，寻找企业级落地场景' },
  { name: 'Ethan', org: '真格基金', focus: '关注开发者工具，寻找技术型创始人' },
  { name: 'Coco', org: '小红书', focus: '关注推荐系统优化，寻找算法团队交流' },
  { name: 'Rex', org: 'DeepSeek', focus: '关注大模型训练效率，寻找infra方向合作' },
  { name: 'Yuki', org: '蚂蚁集团', focus: '关注隐私计算，寻找跨机构数据合作' },
  { name: 'Neo', org: '独立开发者', focus: '关注AI Native应用，寻找产品共创伙伴' },
]

export default function Hero() {
  const [stats, setStats] = useState<{ events: number; agents: number } | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  return (
    <section className="hero">
      <div className="hero-brand">LINKA</div>
      <h1 className="hero-slogan">让每场活动，都变成人脉引擎</h1>
      <p className="hero-subtitle">
        AI 帮你发现现场最值得认识的人。无需下载 App，和你的 AI 助手说一句话就能加入。
      </p>
      <a className="hero-cta" href="#showcase">
        了解如何接入
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </a>
      <p className="hero-helper">支持 Claude Desktop / 飞书 aily / QClaw 等 MCP 客户端</p>

      {stats && (
        <div className="hero-stats">
          <span className="hero-stat-line">
            <span className="pulse-dot" />
            {stats.events} 场活动正在运行
          </span>
          <span className="hero-stat-line">
            <span className="pulse-dot" />
            {stats.agents} 个 Agent 已接入
          </span>
        </div>
      )}

      <div className="hero-ticker">
        <div className="hero-ticker-track">
          {[...TICKER_DATA, ...TICKER_DATA].map((item, i) => (
            <span className="hero-ticker-card" key={i}>
              <span className="hero-ticker-name">{item.name}</span>
              <span className="hero-ticker-sep">·</span>
              {item.org}
              <span className="hero-ticker-sep">·</span>
              {item.focus}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 配置 Vite dev server 代理**

在 `web/vite.config.ts` 中添加 proxy 配置，让前端开发时能访问后端 API：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 3: 手动验证**

1. 终端 1: `pnpm dev` (后端 localhost:3000)
2. 终端 2: `cd web && pnpm dev` (前端 localhost:5173)
3. 打开浏览器检查：
   - Hero 底部显示统计数字 + 绿色脉冲点
   - Ticker 条无缝从左滚动
   - 两端有渐变遮罩

- [ ] **Step 4: 提交**

```bash
git add web/src/components/Hero.tsx web/vite.config.ts
git commit -m "feat: add live stats indicator and agent ticker to Hero"
```

---

### Task 4: 运行全部测试验证

**Files:** 无新文件

- [ ] **Step 1: 运行后端测试**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: 提交（如有修复）**

仅在 Task 4 Step 1 发现问题并修复后提交。
