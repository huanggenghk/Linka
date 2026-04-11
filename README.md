# AgentNetwork Social

基于 MCP 协议的 Agent 社交网络平台。AI Agent 代表用户在线下活动中发现和建立人脉。

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
│  SQLite + Drizzle ORM (WAL mode)     │
└──────────────────────────────────────┘
```

**纯 MCP 架构**，不需要 REST API。所有操作通过 MCP 工具完成。Hono 只作为 HTTP 载体，挂载 MCP Server 的 Streamable HTTP 传输。每个请求创建新的 McpServer 实例（无状态），数据通过 SQLite 持久化。

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
├── types.ts          # 共享 TypeScript 类型
├── db/
│   ├── schema.ts     # Drizzle schema（users, events, agents）
│   └── index.ts      # createDb() 工厂函数，WAL 模式，建表
└── mcp/
    └── tools.ts      # 3 个 MCP 工具定义

test/
├── helpers.ts        # 测试工具：createTestApp()、callTool()
├── mcp.test.ts       # 单元测试：每个工具的正常/异常路径（12 个）
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
```

**身份机制**: 用户首次加入活动时获得 `user_token`（即 users.id），Agent 记住此 token，后续跨活动复用。重复加入同一活动会 upsert 更新画像和联系方式。

## MCP 工具

### create_event
主办方创建活动，返回 `event_id` + `invite_code`。

### join_event
参会者通过邀请码加入活动。输入：邀请码、用户名、画像、联系方式、可选 user_token。支持 upsert（重复加入更新画像）。

### get_attendees
获取活动所有参会者的画像和联系方式。Agent 基于用户上下文做推荐排序。

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 运行测试
pnpm test

# 生产构建
pnpm build
node dist/index.js
```

环境变量：
- `PORT` — 服务端口（默认 3000）
- `DB_PATH` — SQLite 文件路径（默认 data.db）

## 线上部署

当前部署在阿里云 ECS（华北2 北京）：

- **MCP 地址**: `http://123.56.163.63:3000/mcp`
- **健康检查**: `http://123.56.163.63:3000/health`
- **服务管理**: systemd（`agentnetwork.service`），开机自启，崩溃自动重启

### 更新部署

本地构建后通过 scp 上传（GitHub 从国内访问不稳定）：

```bash
# 本地打包
tar czf /tmp/agentnetwork.tar.gz --exclude=node_modules --exclude='*.db*' --exclude=dist --exclude=.git .

# 上传到服务器
scp /tmp/agentnetwork.tar.gz root@123.56.163.63:/root/

# 服务器上更新
ssh root@123.56.163.63 'cd /root/AgentNetwork_Social && tar xzf /root/agentnetwork.tar.gz && pnpm install --registry=https://registry.npmmirror.com && pnpm build && systemctl restart agentnetwork'
```

### 服务器信息

- IP: 123.56.163.63
- OS: Ubuntu 22.04
- Node.js: 22.16.0（通过 npmmirror 安装）
- 配置: 2C2G, 40G ESSD, 3M 带宽
- DB 路径: `/root/AgentNetwork_Social/data/agentnetwork.db`
- npm 镜像: registry.npmmirror.com（国内加速）

## 客户端配置

### Claude Desktop

```json
{
  "mcpServers": {
    "agentnetwork-social": {
      "type": "streamableHttp",
      "url": "http://123.56.163.63:3000/mcp"
    }
  }
}
```

### 飞书 aily

在 aily 后台添加 MCP 工具，地址填 `http://123.56.163.63:3000/mcp`。

## 项目状态

MVP 已完成并上线。17 个自动化测试全部通过。

完成的工作：
- [x] 项目初始化（TypeScript, pnpm, vitest）
- [x] 数据库 & Schema（SQLite + Drizzle, WAL 模式）
- [x] MCP Server（3 个工具 + Hono Streamable HTTP）
- [x] 代码可测试性重构（createApp/createDb 工厂函数）
- [x] 自动化测试（12 单元测试 + 5 E2E 测试）
- [x] 阿里云部署（systemd 服务）

后续规划见 [TODOS.md](./TODOS.md)。
