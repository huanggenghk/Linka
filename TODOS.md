# 需求池

## P1 - 高优先级

### 微信 Agent 社交链接层（下一阶段产品方向）
- **来源**: 2026-05-19 产品讨论
- **描述**: 将 Linka 从“活动人脉工具”升级为微信关系链上的 Agent 社交链接层。小程序作为微信前台入口，Agent 作为后台维护者；私聊建立一条 Agent-to-Agent 社交边，群聊形成一个由多 Agent 维护的社交网络。
- **核心动作**: 让我的 AI 助手接管这里的社交链接。
- **绑定方案**: 小程序生成一次性绑定码，Linka Skill 调 REST API 认领绑定。
- **当前 MVP**: ✅ 真实微信登录已实现；✅ 私聊 Agent 绑定闭环已实现；✅ 私聊双方建联 MVP 已实现；✅ Skill 画像更新已实现；✅ Skill 更新机制已实现；✅ MCP 协议层已移除；✅ 活动兼容层已彻底移除；✅ 测试环境和开发-测试-生产发布流程已建立；后续由微信群聊加入替代活动场景，暂不做群聊网络。
- **文档**: `docs/superpowers/specs/2026-05-19-wechat-agent-social-links-design.md`、`docs/superpowers/specs/2026-05-19-skill-api-agent-binding-design.md`、`docs/superpowers/specs/2026-05-19-private-agent-binding-mvp-design.md`、`docs/superpowers/specs/2026-05-19-direct-link-mvp-design.md`、`docs/superpowers/specs/2026-05-19-wechat-real-login-design.md`、`docs/superpowers/specs/2026-05-19-agent-profile-update-skill-design.md`、`docs/superpowers/specs/2026-05-19-linka-skill-update-mechanism-design.md`、`docs/superpowers/specs/2026-05-19-remove-mcp-protocol-design.md`、`docs/superpowers/specs/2026-05-20-remove-activity-rest-api-design.md`、`docs/superpowers/specs/2026-05-20-release-environment-flow-design.md`
- **依赖**: 微信小程序入口、一次性绑定码、Linka Skill、用户身份和授权模型

### ~~私聊双方建联~~ ✅ 已完成
- **来源**: mini-wx MVP scope cut
- **描述**: 在 Agent 绑定完成后，支持用户通过私聊小程序卡片和对方建立一条长期维护的社交边。
- **完成时间**: 2026-05-19
- **依赖**: 双方都完成 Agent 绑定、关系边数据模型、同意/确认流程

### ANP 协议集成（DID 身份）
- **来源**: CEO plan
- **描述**: 接入 ANP 协议，用 DID 替代 user_token 作为持久身份。这是长期方向。
- **依赖**: ANP SDK 成熟度

### ~~微信小程序真实登录~~ ✅ 已完成
- **来源**: 真机测试准备
- **描述**: 小程序通过 `wx.login` 获取 code，服务端使用 `code2Session` 换取 `openid`，后续小程序 API 使用 Linka session token 鉴权。
- **完成时间**: 2026-05-19
- **依赖**: 微信小程序 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`

### ~~Skill 用户画像更新~~ ✅ 已完成
- **来源**: CEO plan
- **描述**: Linka Skill 支持用户确认后的手动画像更新，以及默认每天 1 次的静默自动总结更新。用户可以修改自动总结频次和时机。
- **完成时间**: 2026-05-19
- **依赖**: Agent 绑定后的 `agent_token`

### ~~Linka Skill 更新机制~~ ✅ 已完成
- **来源**: CEO plan，参考 gstack
- **描述**: Linka Skill 支持版本检查、更新提示、snooze、just-updated marker 和 vendored 自更新。完整 Git 工作区内拒绝自动 reset，避免覆盖产品代码。
- **完成时间**: 2026-05-19
- **依赖**: `skills/linka/VERSION`、GitHub raw VERSION、Linka 仓库远端

### ~~MCP 协议层退役~~ ✅ 已完成
- **来源**: CEO 决策
- **描述**: 移除 Hono `/mcp` Streamable HTTP 端点、MCP SDK 依赖和 MCP tool 测试。活动 REST API 曾短暂承接 legacy 能力，已在 2026-05-20 进一步退役。
- **完成时间**: 2026-05-19
- **文档**: `docs/superpowers/specs/2026-05-19-remove-mcp-protocol-design.md`

### ~~活动兼容层彻底移除~~ ✅ 已完成
- **来源**: CEO 决策
- **描述**: 移除 `POST /api/events`、`POST /api/events/join`、`GET /api/events/:event_id/attendees`、`GET /api/stats`、`GET /join/:code`、`GET /card/:code.png`、旧活动表、邀请卡生成依赖和旧兼容测试。后续多人加入按微信群聊加入重新设计。
- **完成时间**: 2026-05-20
- **文档**: `docs/superpowers/specs/2026-05-20-remove-activity-rest-api-design.md`

### ~~正式部署（VPS/云）~~ ✅ 已完成
- **来源**: codex review
- **描述**: ~~本地 + tunnel 不适合生产。~~ 已部署到阿里云 ECS（华北2 北京），systemd 管理。
- **完成时间**: 2026-04-12

### ~~测试环境与发布流程~~ ✅ 已完成
- **来源**: CEO 流程纠偏
- **描述**: 建立 `linka-test.service` 测试后端、独立测试数据库和 `https://linka.zone/test-api` 入口；生产部署强制只允许从 `main` 执行，功能分支只能部署测试环境。
- **完成时间**: 2026-05-20
- **文档**: `docs/superpowers/specs/2026-05-20-release-environment-flow-design.md`

## P2 - 中优先级

### 联系请求流程（隐私保护模式）
- **来源**: eng review（被简化掉的功能）
- **描述**: MVP 直接暴露联系方式。后续可加"发起联系"解锁模式，保护隐私。
- **依赖**: 通知机制

### 跨活动记忆
- **来源**: CEO plan（deferred）
- **描述**: 跨多个活动记住用户社交关系，提醒"你在上次活动认识了张三"。
- **依赖**: 持久身份（ANP DID）

## P3 - 低优先级

### Agent 手动协议（渐进信息交换）
- **来源**: CEO plan（deferred）
- **描述**: Agent 之间渐进式交换信息，而不是一次性暴露全部。

### 破冰话题生成
- **来源**: CEO plan（deferred）
- **描述**: 基于双方画像自动生成破冰话题建议。

### 匹配理由透明化
- **来源**: CEO plan（deferred）
- **描述**: 告诉用户为什么推荐这个人（"你们都在做 RAG"）。

### 异步事后匹配
- **来源**: CEO plan（deferred）
- **描述**: 活动结束后继续匹配，解决时间窗口限制。
