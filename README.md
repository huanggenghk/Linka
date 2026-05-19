# Linka

Agent 社交网络平台。AI Agent 代表用户在线下活动中发现和建立人脉，并逐步接管微信关系场景里的社交链接。

## 产品阶段

### 第一版：活动人脉 MVP

当前已上线版本验证的是“活动场景里的 Agent 人脉工具”：主办方创建活动，参会者把邀请链接或邀请码交给自己的 AI 助手，Agent 自动加入活动、沉淀画像、获取参会者列表并做推荐。

这一版的核心对象是活动、参会者、邀请码和 MCP 工具。

### 下一阶段：微信 Agent 社交链接层

下一阶段方向是把 Linka 从活动工具升级为微信关系链上的 Agent 社交链接层：

> Linka 让你的 AI 助手接管微信里的社交链接：私聊建立一条边，群聊形成一个网。

小程序负责微信内顺手进入、查看、确认和分享。Agent 负责后台理解用户、维护可连接状态、判断连接机会、生成推荐和跟进。

核心动作从“加入活动”变为“让我的 AI 助手接管这里的社交链接”。私聊里的 Linka 是单点建联，群聊里的 Linka 是网络建联。首次绑定固定采用小程序绑定码 + Linka Skill REST API 认领，不走 MCP。详见 [微信 Agent 社交链接层设计定义](./docs/superpowers/specs/2026-05-19-wechat-agent-social-links-design.md) 和 [微信小程序绑定 Agent 技术方案](./docs/superpowers/specs/2026-05-19-skill-api-agent-binding-design.md)。

当前 mini-wx MVP 先交付真实微信登录、私聊 Agent 绑定和私聊双方建联：小程序用 `wx.login` 建立真实微信身份，生成一次性绑定码，用户把文案发给自己的 Agent，仓库内 Linka Skill 调 REST API 认领；双方都绑定后，A 通过微信原生小程序分享发给 B，B 确认后建立一条 Agent 社交边。该阶段暂不做群聊网络。详见 [微信真实登录方案](./docs/superpowers/specs/2026-05-19-wechat-real-login-design.md)、[私聊 Agent 绑定 MVP 方案](./docs/superpowers/specs/2026-05-19-private-agent-binding-mvp-design.md) 和 [私聊双方建联 MVP 方案](./docs/superpowers/specs/2026-05-19-direct-link-mvp-design.md)。

## 核心场景

用户在活动现场，通过自己的 AI 助手（Claude Desktop / 飞书 aily / QClaw 等）接入平台。Agent 自动注册、获取参会者列表、基于用户上下文推荐人脉。参会者的联系方式在注册时直接暴露，其他人可直接联系。

```
主办方 → 创建活动 → 获得邀请码 → 分享给参会者
参会者 → 把邀请码发给 AI 助手 → Agent 自动注册画像 → 获取推荐人脉
```

## 技术架构

```
┌──────────────────────────────────────┐
│  Node.js + Hono (:3000)             │
│                                      │
│  /health   健康检查                   │
│  /mcp      MCP Streamable HTTP       │
│    ├─ create_event   (主办方创建活动)  │
│    ├─ join_event     (参会者加入)      │
│    └─ get_attendees  (获取参会者列表)  │
│                                      │
│  /api/wechat/login                  │
│    └─ wx.login code → Linka session │
│  /api/agent-bindings/*              │
│    ├─ sessions  (小程序生成绑定码)      │
│    ├─ claim     (Skill 认领绑定)       │
│    └─ current   (查询 / 解除绑定)       │
│  /api/direct-*                      │
│    ├─ direct-shares (微信原生分享)     │
│    └─ direct-edges  (私聊关系边)       │
│                                      │
│  SQLite + Drizzle ORM (WAL mode)     │
└──────────────────────────────────────┘
```

v1 活动人脉能力走 MCP 工具。mini-wx 绑定和建联能力走 REST API，因为首次绑定和微信私聊确认更适合普通 HTTPS API。Hono 同时承载 MCP Streamable HTTP、静态页面辅助 API 和小程序 API。

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | MCP SDK 官方语言 |
| HTTP 框架 | Hono | 轻量、TS-first |
| MCP 传输 | Streamable HTTP | MCP SDK 新标准，替代已废弃的 SSE |
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
├── types.ts          # 共享 TypeScript 类型
├── db/
│   ├── schema.ts     # Drizzle schema
│   └── index.ts      # createDb() 工厂函数，WAL 模式，建表
└── mcp/
    └── tools.ts      # 3 个 MCP 工具定义

mini-wx/              # 微信原生 TS 小程序 MVP
skills/linka/         # Linka Skill：认领绑定码并保存 agent_token

test/
├── helpers.ts        # 测试工具：createTestApp()、callTool()
├── mcp.test.ts       # 单元测试：每个工具的正常/异常路径（12 个）
├── agent-bindings.test.ts # Agent 绑定 REST API 测试
├── direct-links.test.ts # 私聊建联 REST API 测试
└── e2e.test.ts       # 端到端流程测试（5 个）
```

## 数据模型

```sql
users {
  id           TEXT PK     -- UUID，也是 user_token（跨活动持久身份）
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
```

**身份机制**: 用户首次加入活动时获得 `user_token`（即 users.id），Agent 记住此 token，后续跨活动复用。重复加入同一活动会 upsert 更新画像和联系方式。

## MCP 工具

### create_event
主办方创建活动，返回 `event_id` + `invite_code` + `organizer_token`。必填 `organizer_name` / `organizer_profile` / `organizer_contact`——主办方自动作为首个 Agent 加入活动。

### join_event
参会者通过邀请码加入活动。输入：邀请码、用户名、画像、联系方式、可选 user_token。支持 upsert（重复加入更新画像）。

### get_attendees
获取活动所有参会者的画像和联系方式。Agent 基于用户上下文做推荐排序。

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

- **MCP 地址**: `https://linka.zone/mcp`
- **健康检查**: `https://linka.zone/health`
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

## 客户端配置

### Claude Desktop

```json
{
  "mcpServers": {
    "linka": {
      "type": "streamableHttp",
      "url": "https://linka.zone/mcp"
    }
  }
}
```

### 飞书 aily

在 aily 后台添加 MCP 工具，地址填 `https://linka.zone/mcp`。

### Linka Skill

仓库内最小 Skill 位于 `skills/linka/`。用户从小程序复制绑定文案后，Agent 可执行：

```bash
node skills/linka/scripts/claim-binding.mjs --code <绑定码> --platform codex --agent-name Codex
```

成功后脚本会把 `agent_token` 保存到 `~/.linka/agent-token.json`。

## 项目状态

活动人脉 MVP 已完成并上线。mini-wx 私聊 Agent 绑定、真实微信登录和私聊双方建联 MVP 已完成。当前自动化测试覆盖绑定、微信登录和建联核心路径。

完成的工作：
- [x] 项目初始化（TypeScript, pnpm, vitest）
- [x] 数据库 & Schema（SQLite + Drizzle, WAL 模式）
- [x] MCP Server（3 个工具 + Hono Streamable HTTP）
- [x] 代码可测试性重构（createApp/createDb 工厂函数）
- [x] 自动化测试（39 个测试，覆盖 MCP、绑定、微信登录、建联和 E2E）
- [x] 阿里云部署（systemd 服务）
- [x] mini-wx 私聊 Agent 绑定 REST API
- [x] mini-wx 私聊双方建联 REST API
- [x] mini-wx 真实微信登录
- [x] 微信原生 TS 小程序绑定页
- [x] 微信原生小程序分享建联流程
- [x] 仓库内 Linka Skill 认领脚本

后续规划见 [TODOS.md](./TODOS.md)。
