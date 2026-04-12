# Linka 前端介绍页设计文档

## 概述

为 linka.zone 构建一个产品介绍页，面向活动组织者和 AI 开发者/技术用户两类受众，介绍 Linka 的核心价值并提供快速接入指引。

## 技术方案

- **前端**: React + Vite，独立前端项目
- **部署**: 构建后由 Nginx 托管静态文件，与现有 Hono MCP 服务分离
- **后端 API**: 未来由 Hono 提供 REST API 端点（本期不涉及）
- **域名**: linka.zone（已配置 Nginx + HTTPS）

### 项目结构

```
web/                     # 前端项目根目录
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   └── components/
│       ├── Hero.tsx
│       ├── ValueProps.tsx
│       ├── Perspectives.tsx
│       ├── ChatDemo.tsx
│       ├── FAQ.tsx
│       └── Footer.tsx
└── public/
```

### 扩展性考虑

选择 React + Vite 前后端分离架构，是为了后续扩展：
- 实时活动展示
- 人脉连接数量统计
- Agent 画像分布可视化
- 可引入 Recharts/ECharts 等图表库

本期只做静态介绍页，不涉及动态数据和 API 调用。

## 设计风格

- **调性**: 温暖产品风（类似 Notion、Linear）
- **配色**: 亮色背景 (#faf8f5)，橙色主色 (#e67e22)，紫色辅色 (#7c6aff)
- **字体**: 系统字体栈
- **整体感觉**: 亲和、现代、专业

## 页面结构（从上到下）

### 1. Hero 区域

- **Slogan**: 让每场活动，都变成人脉引擎
- **副标题**: 精准发现 · 自动沉淀 · 实时激活
- **MCP 配置代码块**: 内嵌深色代码区域，展示 MCP 接入配置，带「复制」按钮
  ```json
  {
    "mcpServers": {
      "linka": {
        "url": "https://linka.zone/mcp"
      }
    }
  }
  ```
- **辅助文案**: 「添加到你的 AI 助手配置中，即刻开始」

### 2. 核心价值（三列卡片）

| 图标 | 标题 | 描述 |
|------|------|------|
| 🎯 | 精准发现 | AI 根据你的需求，找到最值得认识的人 |
| 💎 | 自动沉淀 | 人脉自动归档，需要时精准激活 |
| 🔄 | 实时画像 | 画像随对话更新，始终匹配最新的你 |

### 3. 双视角板块（两列并排）

**标题**: 两种角色，同一个平台

**活动组织者**（橙色顶线）:
- 每场活动自动沉淀参与者画像，越办越了解你的社群
- 基于真实画像数据，策划更有针对性的活动主题
- 精准邀约对的人参加对的活动，提升每场活动质量
- 数据驱动社群运营，让活动的长期价值持续增长

**活动参与者**（紫色顶线）:
- 告诉 AI 你的需求，精准匹配现场最相关的人
- 画像随对话实时更新，推荐始终基于最新的你
- 跨活动人脉自动积累，随时激活历史连接
- 无需下载 App，和你的 AI 助手说一句话就能加入

### 4. 对话演示

模拟一段真实的用户与 AI 对话，气泡式 UI：

> **用户**: 帮我加入活动，邀请码是 A2B3C4D5
>
> **AI**: 已加入「AI Builder Meetup」✅ 当前 23 人参加。我发现有 3 位和你背景高度匹配...

对话内容可以考虑展示多轮，演示从加入到匹配推荐的完整流程。

### 5. FAQ（折叠手风琴）

预设问题：
- **什么是 MCP？** — MCP（Model Context Protocol）是一种让 AI 助手连接外部工具的开放协议。Linka 通过 MCP 让你的 AI 助手具备社交网络能力。
- **需要下载 App 吗？** — 不需要。Linka 运行在你已有的 AI 助手中（如 Claude、飞书等），只需添加 MCP 配置即可。
- **我的数据安全吗？** — 你的画像信息仅用于活动内的匹配推荐，不会被用于其他用途。
- **支持哪些 AI 助手？** — 任何支持 MCP 协议的 AI 客户端都可以接入，包括 Claude Desktop、飞书 aily、QClaw 等。

### 6. Footer

- Linka 品牌名
- GitHub 链接
- 联系方式
- © 2026 Linka

## 部署方案

1. 在 `web/` 目录下 `pnpm build`，产出 `dist/` 目录
2. 将 `dist/` 部署到服务器
3. Nginx 配置：`linka.zone` 的 `/` 路由指向静态文件，`/mcp` 和 `/health` 继续代理到 Hono 服务

```nginx
server {
    server_name linka.zone;

    # 静态前端
    root /var/www/linka;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # MCP 服务代理
    location /mcp {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
    }

    # SSL (managed by certbot)
}
```
