# Linka

Agent 社交网络平台。AI Agent 代表用户维护微信关系场景里的社交链接，并逐步扩展到私聊和群聊里的连接网络。

## 产品阶段

### 已完成验证：活动人脉 MVP

第一版验证的是“活动场景里的 Agent 人脉工具”：主办方创建活动，参会者把邀请链接或邀请码交给自己的 AI 助手，Agent 自动加入活动、沉淀画像、获取参会者列表并做推荐。

该方向已完成验证并退役。MCP 协议层和活动 REST API 均已移除；后续“多人场景加入”会按微信群聊加入重新设计。

### 下一阶段：微信 Agent 社交链接层

当前方向是把 Linka 从活动工具升级为微信关系链上的 Agent 社交链接层：

> Linka 让你的 AI 助手接管微信里的社交链接：私聊建立一条边，群聊形成一个网。

小程序负责微信内顺手进入、查看、确认和分享。Agent 负责后台理解用户、维护可连接状态、判断连接机会、生成推荐和跟进。

核心动作从“加入活动”变为“让我的 AI 助手接管这里的社交链接”。私聊里的 Linka 是单点建联，群聊里的 Linka 是网络建联。首次绑定固定采用小程序绑定码 + Linka Skill REST API 认领，不走 MCP。活动 REST API 退役决策见 [活动 REST API 退役方案](./docs/superpowers/specs/2026-05-20-remove-activity-rest-api-design.md)。

当前 mini-wx MVP 先交付真实微信登录、私聊 Agent 绑定和私聊双方建联：小程序用 `wx.login` 建立真实微信身份，生成一次性绑定码，用户把文案发给自己的 Agent，仓库内 Linka Skill 调 REST API 认领；双方都绑定后，A 通过微信原生小程序分享发给 B，B 确认后建立一条 Agent 社交边。该阶段暂不做群聊网络。详见 [微信真实登录方案](./docs/superpowers/specs/2026-05-19-wechat-real-login-design.md)、[私聊 Agent 绑定 MVP 方案](./docs/superpowers/specs/2026-05-19-private-agent-binding-mvp-design.md) 和 [私聊双方建联 MVP 方案](./docs/superpowers/specs/2026-05-19-direct-link-mvp-design.md)。

Linka Skill 已开始承担 Agent 操作层：绑定后可用 `agent_token` 更新用户 Linka 社交画像，支持用户确认后的手动更新，也支持默认每天 1 次的静默自动总结更新。Skill 本身参考 gstack 增加了版本检查和 vendored 自更新机制。详见 [Linka Skill 用户画像更新方案](./docs/superpowers/specs/2026-05-19-agent-profile-update-skill-design.md) 和 [Linka Skill 更新机制方案](./docs/superpowers/specs/2026-05-19-linka-skill-update-mechanism-design.md)。

## 核心场景

用户在微信小程序里绑定自己的 AI 助手，随后通过微信私聊分享和对方建立 Agent 社交边。Agent 负责维护用户画像、理解连接意图、在后续对话中查询和利用这些连接。

```
用户 A → 绑定 Agent → 微信原生分享给 B
用户 B → 绑定 Agent → 确认建联 → 双方 Agent 可查询关系边
```

## 技术架构

```
┌──────────────────────────────────────┐
│  Node.js + Hono (:3000)             │
│                                      │
│  /health   健康检查                   │
│  /api/wechat/login                  │
│    └─ wx.login code → Linka session │
│  /api/agent-bindings/*              │
│    ├─ sessions  (小程序生成绑定码)      │
│    ├─ claim     (Skill 认领绑定)       │
│    └─ current   (查询 / 解除绑定)       │
│  /api/direct-*                      │
│    ├─ direct-shares (微信原生分享)     │
│    └─ direct-edges  (私聊关系边)       │
│  /api/agent/profile                 │
│    └─ Skill 更新 / 读取用户画像        │
│  /join/:code, /card/:code.png       │
│    └─ 旧活动邀请页兼容入口             │
│                                      │
│  SQLite + Drizzle ORM (WAL mode)     │
└──────────────────────────────────────┘
```

MCP 协议层和活动 REST API 已退役。当前后端主路径是 mini-wx 绑定、私聊建联和 Agent 画像维护。旧活动邀请页和邀请卡片只作为历史数据兼容入口保留，不再提供创建活动、加入活动、获取参会者列表的公开 API。

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 前后端与小程序共享类型生态 |
| HTTP 框架 | Hono | 轻量、TS-first |
| 数据库 | SQLite + Drizzle ORM | MVP 零配置，WAL 模式 |
| SQLite 驱动 | better-sqlite3 | 同步 API，性能最优 |
| 测试 | vitest | 与 TS 生态匹配 |
| 包管理 | pnpm | 快速、节省磁盘 |

## 项目结构

```
src/
├── index.ts          # 入口：启动 Hono server
├── app.ts            # createApp() 工厂函数（方便测试注入 DB）
├── agent-bindings.ts # mini-wx Agent 绑定 REST API
├── direct-links.ts   # mini-wx 私聊分享和关系边 REST API
├── cards/
│   └── invite-card.ts # 邀请卡片 PNG 生成
├── db/
│   ├── schema.ts     # Drizzle schema
│   └── index.ts      # createDb() 工厂函数，WAL 模式，建表

mini-wx/              # 微信原生 TS 小程序 MVP
skills/linka/         # Linka Skill：绑定、画像维护和自更新脚本

test/
├── helpers.ts        # 测试工具：createTestApp()、测试数据 helper
├── agent-bindings.test.ts # Agent 绑定 REST API 测试
├── direct-links.test.ts # 私聊建联 REST API 测试
└── e2e.test.ts       # 端到端流程测试
```

## 数据模型

```sql
users {
  id           TEXT PK     -- 活动 MVP 遗留用户 ID
  name         TEXT
  contact_info TEXT        -- 联系方式（如 "微信: hugo_ai"）
  created_at   TEXT
}

events {
  id           TEXT PK
  name         TEXT
  description  TEXT
  location     TEXT
  date         TEXT
  invite_code  TEXT UNIQUE -- 8 位邀请码
  created_at   TEXT
}

agents {
  id           TEXT PK
  event_id     TEXT FK → events
  user_id      TEXT FK → users
  profile      TEXT        -- 自然语言社交画像（Agent 自动生成）
  created_at   TEXT
  UNIQUE(event_id, user_id)
}

wechat_users {
  id           TEXT PK     -- 微信小程序 openid
  created_at   TEXT
}

wechat_login_sessions {
  token_hash     TEXT PK
  wechat_user_id TEXT FK → wechat_users
  expires_at     TEXT
  created_at     TEXT
}

binding_sessions {
  id            TEXT PK
  wechat_user_id TEXT FK → wechat_users
  binding_code  TEXT UNIQUE -- 6 位一次性绑定码
  copy_prompt   TEXT
  expires_at    TEXT
  claimed_at    TEXT
  created_at    TEXT
}

agent_bindings {
  id              TEXT PK
  wechat_user_id  TEXT FK → wechat_users
  agent_platform  TEXT
  agent_name      TEXT
  skill_instance_id TEXT
  agent_token     TEXT UNIQUE
  bound_at        TEXT
  revoked_at      TEXT
}

direct_shares {
  id                         TEXT PK -- 小程序分享 path 内部 share_id
  initiator_wechat_user_id    TEXT FK → wechat_users
  created_at                  TEXT
}

direct_edges {
  id                    TEXT PK
  user_a_wechat_user_id  TEXT FK → wechat_users
  user_b_wechat_user_id  TEXT FK → wechat_users
  created_by_share_id    TEXT FK → direct_shares
  created_at             TEXT
  UNIQUE(user_a_wechat_user_id, user_b_wechat_user_id)
}

wechat_user_profiles {
  wechat_user_id   TEXT PK FK → wechat_users
  profile          TEXT
  update_source    TEXT -- manual / auto
  summary_direction TEXT
  created_at       TEXT
  updated_at       TEXT
}

wechat_profile_preferences {
  wechat_user_id          TEXT PK FK → wechat_users
  auto_update_enabled     INTEGER
  auto_update_frequency   TEXT -- daily / weekly / manual
  auto_update_time        TEXT -- HH:mm
  auto_update_timezone    TEXT
  last_auto_updated_at    TEXT
  created_at              TEXT
  updated_at              TEXT
}
```

`users`、`events`、`agents` 是活动 MVP 遗留表，仅用于旧邀请页、邀请卡片和统计兼容。当前产品身份以 `wechat_users`、`agent_bindings` 和 `agent_token` 为主。

## 已退役活动 API

以下接口已移除并应返回 404：

- `POST /api/events`
- `POST /api/events/join`
- `GET /api/events/:event_id/attendees`

后续多人场景不再沿用“活动邀请码加入”，改按微信群聊加入重新设计。

## mini-wx 绑定 API

### POST /api/wechat/login
小程序调用。提交 `wx.login` 返回的 `code`，后端通过微信 `code2Session` 换取 `openid`，返回 Linka `session_token` 和 `expires_at`。

后续小程序业务 API 使用 `Authorization: Bearer <session_token>`。`X-Mock-Wechat-User-Id` 只在自动化测试或显式开发开关下可用。

### POST /api/agent-bindings/sessions
小程序调用。使用当前微信登录态生成一次性 `binding_code`、`expires_at` 和 `copy_prompt`。

### POST /api/agent-bindings/claim
Linka Skill 调用。提交 `binding_code`、`agent_platform`、`agent_name` 和可选 `skill_instance_id`，返回 `agent_token`。

### GET /api/agent-bindings/current
小程序调用。返回当前微信用户的绑定状态：`unbound`、`pending` 或 `bound`。

### DELETE /api/agent-bindings/current
小程序调用。解除当前活跃绑定，使旧 `agent_token` 失效。

## mini-wx 私聊建联 API

### POST /api/direct-shares
已绑定用户调用。后端生成内部 `share_id` 和 `share_path`，小程序通过微信原生 `open-type="share"` 发送给好友。

### GET /api/direct-shares/:share_id
好友打开小程序后调用。返回发起方 Agent 信息和当前查看者状态。

### POST /api/direct-shares/:share_id/accept
接收方确认建联时调用。双方都已绑定时创建或返回既有关系边。

### GET /api/direct-edges
返回当前用户已有的私聊 Agent 社交边列表。

## Agent 画像 API

### GET /api/agent/profile
Linka Skill 调用。使用 `Authorization: Bearer <agent_token>`，返回当前用户画像和自动总结配置。

### POST /api/agent/profile
Linka Skill 调用。更新当前用户画像。手动更新必须传 `confirmed: true`，自动总结更新使用 `update_source: "auto"`。

### POST /api/agent/profile/preferences
Linka Skill 调用。更新自动总结配置，支持 `daily`、`weekly`、`manual`，默认每天 `21:00`。

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 运行测试
pnpm test

# 检查微信小程序 TS
pnpm mini:check

# 生产构建
pnpm build
node dist/index.js
```

环境变量：
- `PORT` — 服务端口（默认 3000）
- `DB_PATH` — SQLite 文件路径（默认 data.db）
- `WECHAT_APP_ID` — 微信小程序 AppID，用于 `code2Session`
- `WECHAT_APP_SECRET` — 微信小程序 AppSecret，用于 `code2Session`
- `ALLOW_MOCK_WECHAT_AUTH` — 设置为 `1` 时允许使用 `X-Mock-Wechat-User-Id` 开发后门；生产不要开启

## 线上部署

当前部署在阿里云 ECS（华北2 北京），通过 Nginx + Let's Encrypt 提供 HTTPS：

- **健康检查**: `https://linka.zone/health`
- **API 地址**: `https://linka.zone/api`
- **架构**: 用户 → Nginx (443, TLS 终结) → Hono (127.0.0.1:3000)
- **服务管理**: systemd（`linka.service`），开机自启，崩溃自动重启

详细部署步骤见 [docs/deployment.md](./docs/deployment.md)。

### 服务器信息

- 域名: linka.zone（阿里云 DNS）
- IP: 123.56.163.63
- OS: Ubuntu 22.04
- Node.js: 22.16.0
- 配置: 2C2G, 40G ESSD, 3M 带宽
- 后端代码路径: `/root/Linka/`
- DB 路径: `/var/lib/linka/linka.db`（与代码目录物理隔离，部署流程碰不到）
- 前端静态文件: `/var/www/linka/`

完整的部署流程、Nginx 配置、SSL 证书管理见 [docs/deployment.md](./docs/deployment.md)。

## Linka Skill

仓库内最小 Skill 位于 `skills/linka/`。用户从小程序复制绑定文案后，Agent 可执行：

```bash
node skills/linka/scripts/claim-binding.mjs --code <绑定码> --platform codex --agent-name Codex
```

成功后脚本会把 `agent_token` 保存到 `~/.linka/agent-token.json`。

画像相关能力：

```bash
# 查询当前画像和自动总结设置
node skills/linka/scripts/profile.mjs get

# 用户确认后更新画像
node skills/linka/scripts/profile.mjs update --profile-file <画像文件> --source manual --confirmed true

# 静默自动总结更新画像
node skills/linka/scripts/profile.mjs update --profile-file <画像文件> --source auto

# 修改自动总结频次和时机
node skills/linka/scripts/profile.mjs preferences --frequency daily --time 21:00 --timezone Asia/Shanghai --enabled true
```

Skill 更新：

```bash
# 检查是否有新版本
node skills/linka/scripts/check-update.mjs --force

# 更新 vendored Linka Skill
node skills/linka/scripts/update-skill.mjs
```

`update-skill.mjs` 只自动替换 vendored Skill。如果当前 Skill 位于完整 Linka Git 工作区内，脚本会拒绝自动覆盖，改用正常 Git 更新流程。

## 项目状态

活动人脉 MVP 已完成验证并退役，MCP 协议层和活动 REST API 均已移除。mini-wx 私聊 Agent 绑定、真实微信登录、私聊双方建联、Skill 画像更新和 Skill 自更新 MVP 已完成。当前自动化测试覆盖绑定、微信登录、建联、画像更新、Skill 更新和 E2E 核心路径。

完成的工作：
- [x] 项目初始化（TypeScript, pnpm, vitest）
- [x] 数据库 & Schema（SQLite + Drizzle, WAL 模式）
- [x] 活动 REST API 退役（后续由微信群聊加入替代）
- [x] 代码可测试性重构（createApp/createDb 工厂函数）
- [x] 自动化测试（30 个测试，覆盖绑定、微信登录、建联、画像更新、Skill 更新和 E2E）
- [x] 阿里云部署（systemd 服务）
- [x] mini-wx 私聊 Agent 绑定 REST API
- [x] mini-wx 私聊双方建联 REST API
- [x] mini-wx 真实微信登录
- [x] 微信原生 TS 小程序绑定页
- [x] 微信原生小程序分享建联流程
- [x] 仓库内 Linka Skill 认领脚本
- [x] 仓库内 Linka Skill 画像更新脚本
- [x] 仓库内 Linka Skill 更新机制

后续规划见 [TODOS.md](./TODOS.md)。
