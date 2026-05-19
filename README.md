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

当前 mini-wx MVP 先收窄为私聊 Agent 绑定：小程序生成一次性绑定码，用户把文案发给自己的 Agent，仓库内 Linka Skill 调 REST API 认领，绑定成功后小程序显示已连接。该阶段不做私聊双方建边、不做群聊网络、不接真实微信登录。详见 [私聊 Agent 绑定 MVP 方案](./docs/superpowers/specs/2026-05-19-private-agent-binding-mvp-design.md)。

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
│  /api/agent-bindings/*              │
│    ├─ sessions  (小程序生成绑定码)      │
│    ├─ claim     (Skill 认领绑定)       │
│    └─ current   (查询 / 解除绑定)       │
│                                      │
│  SQLite + Drizzle ORM (WAL mode)     │
└──────────────────────────────────────┘
```

v1 活动人脉能力走 MCP 工具。mini-wx 绑定能力走 REST API，因为首次绑定是账号初始化，不需要 MCP 协议参与。Hono 同时承载 MCP Streamable HTTP、静态页面辅助 API 和小程序绑定 API。

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
  id           TEXT PK     -- MVP 阶段为 mock 微信用户 ID
  created_at   TEXT
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

### POST /api/agent-bindings/sessions
小程序调用。使用 `X-Mock-Wechat-User-Id` 模拟微信用户，返回一次性 `binding_code`、`expires_at` 和 `copy_prompt`。

### POST /api/agent-bindings/claim
Linka Skill 调用。提交 `binding_code`、`agent_platform`、`agent_name` 和可选 `skill_instance_id`，返回 `agent_token`。

### GET /api/agent-bindings/current
小程序调用。返回当前 mock 微信用户的绑定状态：`unbound`、`pending` 或 `bound`。

### DELETE /api/agent-bindings/current
小程序调用。解除当前活跃绑定，使旧 `agent_token` 失效。

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

活动人脉 MVP 已完成并上线。mini-wx 私聊 Agent 绑定 MVP 已完成。当前自动化测试 34 个全部通过。

完成的工作：
- [x] 项目初始化（TypeScript, pnpm, vitest）
- [x] 数据库 & Schema（SQLite + Drizzle, WAL 模式）
- [x] MCP Server（3 个工具 + Hono Streamable HTTP）
- [x] 代码可测试性重构（createApp/createDb 工厂函数）
- [x] 自动化测试（12 单元测试 + 5 E2E 测试）
- [x] 阿里云部署（systemd 服务）
- [x] mini-wx 私聊 Agent 绑定 REST API
- [x] 微信原生 TS 小程序绑定页
- [x] 仓库内 Linka Skill 认领脚本

后续规划见 [TODOS.md](./TODOS.md)。
