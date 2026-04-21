# Join 落地页设计 — 2026-04-22

## 背景

每个 Linka 活动都有一个邀请链接 `https://linka.zone/join/:code`。目前 `src/app.ts` 的 `/join/:code` 路由返回一份极简内联 HTML：活动名、日期、地点、描述、邀请码、一句"把链接发给 AI 助手"的说明。文字正确，但视觉上完全不传达 Linka 的核心——"AI Agent 驱动的人脉网络"。

此次迭代重做这张落地页：扫码或点击邀请链接的用户（主要来自手机）第一眼应该感受到"这是一个活的 Agent 网络"，并清楚知道下一步该做什么。

## 目标

1. **传达"活的网络"**：用视觉让用户相信这是一个正在运行的 Agent 网络，不是一张静态说明页
2. **展示该场活动当前的人脉信息**：活跃 Agent 数 + 最近加入的动态流
3. **降低加入门槛**：一键复制邀请链接，明确告诉用户"粘贴给 Claude / 飞书 aily / 其他 AI 助手即可"
4. **保持和邀请卡片视觉一致**：深色 + 琥珀光晕的语言已经在 `src/mcp/card.ts` 建立，落地页延续这套语言

## 非目标

- 不做注册/登录（落地页永远对未登录访客开放）
- 不做 Agent 操作界面（加入动作仍然通过 MCP 完成，不在网页上）
- 不做活动发现/广场（本页只服务一个 `:code` 对应的活动）
- 不做多主题/浅色模式（此页固定深色）

## 视觉方向

延续 `src/mcp/card.ts` 邀请卡的视觉语言：深色基底 `#07090F`、琥珀 `#C28B3E`、深蓝与暖琥珀双色环境光晕、玻璃卡片。

**注意：** 此方向与 `DESIGN.md` 的 editorial/industrial 浅色方向不同。落地页和邀请卡作为"Agent 网络"的对外视觉面，采用深色科技感语言；主站落地页仍保持 `DESIGN.md` 的浅色编辑风。这是一次有意的分叉，落地页完成后会把这次决策补进 `DESIGN.md` 的 Decisions Log。

### 核心视觉元素

1. **粒子网络背景**
   - 全屏 `<canvas>`，~60–120 节点（按屏幕面积缩放）
   - 节点随机低速漂移，边界反弹
   - 两两距离小于阈值时连线，连线透明度与距离成反比
   - 约 8% 节点为琥珀 hub，更大、带呼吸脉冲和径向光晕，表示"活跃 Agent"
   - 鼠标/触摸在 180px 半径内对节点产生轻微吸引力（移动端关闭以省电）

2. **环境光晕**
   - Body 背景叠两层 radial-gradient：右上暖琥珀、左下深蓝
   - 色值、位置复用 `card.ts` 里的 orb 参数

3. **玻璃 CTA 卡片**
   - `backdrop-filter: blur(12px)` + 半透明白底 + 细边框
   - 右上角透出琥珀光点

4. **扫描线叠加**
   - 极轻的横向 scanline（`opacity: 0.6`, `mix-blend-mode: overlay`），加一点 tech 质感，不做到赛博朋克那种夸张

### 页面结构（从上到下）

去掉任何顶栏和邀请码元信息条——进入页面直接是活动标题，视觉焦点不被分散。

1. **活动标题**：大号 Satoshi/DM Sans 700，页面顶部留白 48–64px
2. **活动元信息**：DATE / LOC / HOST 三行，等宽标签 + 正文
3. **LIVE 面板**（重点）：
   - 头部：活跃 Agent 数（大号，带琥珀脉冲点）+ 右侧 `LIVE FEED` 标签
   - 底部：垂直滚动的动态流，无缝循环，上下淡出 mask
   - 每条格式：`{时间} · {姓名} → {意图摘要}`
4. **CTA 卡片**：
   - `加入网络` 标签（琥珀色）
   - 主文案："把这个链接发给你的 AI Agent，自动帮你接入活动"
   - 一键复制链接框（整框点击复制，toast 提示）
   - 3 步引导（复制 → 粘贴给 Agent → Agent 帮你找人）
   - 支持的 Agent 列表（Claude / 飞书 aily / Cursor / ChatGPT MCP / 自建）
5. **页脚**：`POWERED BY MCP` + `linka.zone ↗`

## 数据模型

### 当前 schema 可以复用的

从 `src/db/schema.ts`：
- `events`：name, description, location, date, inviteCode → 提供活动信息
- `agents`：event_id, user_id, profile, created_at → 提供 FEED 数据
- `users`：name, contact_info → 提供 FEED 里的显示名

### 活跃 Agent 数如何计算

**初版定义**：`count(agents where event_id = :eventId)`——即该活动累计加入过的 Agent 数。

放弃了"当前在线"语义的原因：Linka 没有 presence/heartbeat 机制，硬造一个会引入额外状态。用累计数同样能传达"这个网络有人在用"的感觉，且永远非零（只要有人加入过）。

**头部脉冲点仅是视觉装饰，不代表在线状态。** 数字本身不做前端轮询（见下方"数据更新"）。

### LIVE FEED 数据来源

从 `agents` 表取最近 N（初版 N=12）条记录 JOIN `users` 表：

```
SELECT 
  users.name AS who, 
  agents.profile AS what, 
  agents.created_at AS at
FROM agents 
JOIN users ON agents.user_id = users.id
WHERE agents.event_id = :eventId
ORDER BY agents.created_at DESC
LIMIT 12
```

**展示格式**：
- 时间：`刚刚` / `N min 前` / `N 小时前` / `N 天前`（客户端格式化）
- 姓名：直接用 `users.name`
- 意图：`agents.profile` 截断到 40 字符 + 省略号

### 意图字段的简化

DESIGN 里原本考虑新增"seeking/寻找什么"结构化字段，但 `agents.profile` 已经是用户自己写的自我介绍，通常会提到"想找 xxx / 希望认识 xxx"。YAGNI：先用现有 profile 截断，看真实数据质量，再决定要不要新增字段。

## 数据更新策略

**初版：服务端渲染，不做实时刷新。** 页面加载时一次性渲染活跃数 + FEED。

选这个方案因为：
- 每个邀请链接的访问是一次性动作（扫码 → 看 → 复制给 Agent），用户停留时间短
- 实时推送（SSE/WebSocket）会引入长连接和推送基础设施，跟当前阶段的投入不成比例
- FEED 的前端滚动动画已经能制造"活"的视觉感，即使数据是静态的

若未来发现用户停留时间长、有刷新需求，再加轻量轮询（每 30s 拉一次 `/api/events/:code/feed`）。

## 隐私

**初版：`users.name` 是公开的。** Linka 的目标是"让 Agent 帮用户主动建立连接"，加入活动本身就是一个公开动作。`contact_info` 从不暴露在前端。

`agents.profile` 是用户主动输入的自我介绍，同样视为公开内容。截断到 40 字符既避免隐私意外（长文里可能包含敏感细节），也保持 FEED 视觉一致。

**未来考虑**（不在本次范围）：
- 加入时让用户勾选"公开我的意图"，默认关闭则 FEED 里显示匿名（如 `匿名 Agent · 某公司`）
- 提供"从 FEED 移除我"的 MCP tool

## 空态

不用做空态。为此需要改 `create_event` MCP tool：

- **新增必填参数**：`organizer_name`、`organizer_profile`
- **行为**：创建 `events` 记录的同一事务里，同时 `upsert` 一条 `users`（用 name + 一个合成的 contact_info 占位，或者让 organizer 也传 `contact_info`）+ 插入一条 `agents`（`event_id` 指向新活动、`user_id` 指向 organizer、`profile` 存 `organizer_profile`）
- **产品直觉**：没人能想象一个"没有主办方"的活动；办活动的人天然是第一个节点。二维码分享出去后，第一个扫码的人立刻在 FEED 里能看到主办方

这样 `agents` 表对任何有效活动至少 1 条，落地页不用分支空态。

FEED 少于 12 条时，前端滚动轨道按实际数量循环，仍然是无缝循环动画。

**兼容性**：该改动会让旧客户端调用 `create_event` 时缺 `organizer_name` 报错。Linka 当前还在早期、没有外部客户端，可以直接破坏式升级；CHANGELOG 里记录即可。

## 技术实现

### 路由与模板

- 保持 `src/app.ts` 的 `GET /join/:code` 路由
- HTML 模板从内联字符串抽出到 `src/views/join.ts`（函数签名 `renderJoinPage(event, agents)` → `string`）
- CSS、粒子 canvas 的 JS 全部内联在同一个 HTML 文件中，零外部依赖（除 Bunny Fonts CDN）
- 字体：Bunny Fonts 的 DM Sans + JetBrains Mono（GDPR 友好，与 `DESIGN.md` 约定一致），中文 fallback `-apple-system, 'PingFang SC', 'Noto Sans SC'`
- `<meta name="theme-color" content="#07090F">` 让 iOS Safari 状态栏融入深色背景

### 视觉资源

- 不引入任何图片资源，所有视觉元素（光晕、粒子、扫描线、图标）都是纯 CSS + Canvas
- 不展示活动描述 `events.description`：保持页面聚焦在"这是个活的网络 → 快加入"的叙事上，长段描述只会分散注意力

### Canvas 性能

- DPR 上限 2（避免 Retina 屏 4× 导致的 GPU 压力）
- 节点数按屏幕面积动态计算：`Math.min(120, Math.max(40, area / 11000))`
- 减少运动模糊、卡顿：ctx.clearRect 清屏、requestAnimationFrame 驱动，连线不做渐变填充（只改 strokeStyle）
- 移动端关闭触摸吸引（省电），在 `window.matchMedia('(hover: hover)')` 判定

### 降级与访问性

- `prefers-reduced-motion: reduce`：禁用粒子动画（canvas 保持单帧静态），禁用 FEED 滚动，禁用头部脉冲
- 无 JS 环境：canvas 不渲染，页面本身仍然可读（所有关键内容都在 HTML 里）
- 对比度：琥珀 `#C28B3E` 对深色底 4.8:1，正文 `rgba(255,252,244,0.94)` 15:1，均过 WCAG AA

### API 新增

一个只读接口用于未来可能的轮询（初版服务端渲染并不调用，但定义好便于后续扩展）：

```
GET /api/events/:code/feed
→ { 
    active_count: number, 
    entries: [{ name, profile_preview, joined_at }] 
  }
```

## 实施范围边界

**本次要做的：**
- 改 `create_event` MCP tool：新增 `organizer_name` / `organizer_profile`（以及 `organizer_contact` 若需要），创建活动的同时把主办方写入 `users` + `agents`
- 重写 `/join/:code` HTML 模板
- 新增 `src/views/join.ts`
- 从 `agents` + `users` 表读取 FEED 数据
- reduced-motion、404（活动不存在）要覆盖
- 测试：`test/mcp.test.ts` 补 create_event 自动加入主办方的断言；`test/join.test.ts` 覆盖渲染路径、活动不存在

**本次不做：**
- 新增 `participants_intent` 字段
- 实时推送
- 匿名化控件
- 主站浅色落地页的改造

## 已确认的决策

2026-04-22 用户确认：

- 去掉顶栏（LINKA 标识 + `NETWORK · LIVE`）和邀请码元信息条（`INVITE / {code}`）。活动标题作为页面第一个元素
- 不做空态：改 `create_event` 让主办方自动成为首个 Agent，`agents` 表对任何有效活动至少 1 条
- 不展示 `events.description`
