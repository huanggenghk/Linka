# 需求池

## P1 - 高优先级

### 微信 Agent 社交链接层（下一阶段产品方向）
- **来源**: 2026-05-19 产品讨论
- **描述**: 将 Linka 从“活动人脉工具”升级为微信关系链上的 Agent 社交链接层。小程序作为微信前台入口，Agent 作为后台维护者；私聊建立一条 Agent-to-Agent 社交边，群聊形成一个由多 Agent 维护的社交网络。
- **核心动作**: 让我的 AI 助手接管这里的社交链接。
- **绑定方案**: 小程序生成一次性绑定码，Linka Skill 调 REST API 认领绑定，首次绑定不走 MCP。
- **当前 MVP**: ✅ 私聊 Agent 绑定闭环已实现；暂不做私聊双方建边、群聊网络、真实微信登录。
- **文档**: `docs/superpowers/specs/2026-05-19-wechat-agent-social-links-design.md`、`docs/superpowers/specs/2026-05-19-skill-api-agent-binding-design.md`、`docs/superpowers/specs/2026-05-19-private-agent-binding-mvp-design.md`
- **依赖**: 微信小程序入口、一次性绑定码、Linka Skill、用户身份和授权模型

### 私聊双方建联
- **来源**: mini-wx MVP scope cut
- **描述**: 在 Agent 绑定完成后，支持用户通过私聊小程序卡片和对方建立一条长期维护的社交边。
- **依赖**: 双方都完成 Agent 绑定、关系边数据模型、同意/确认流程

### ANP 协议集成（DID 身份）
- **来源**: CEO plan
- **描述**: 接入 ANP 协议，用 DID 替代 user_token 作为持久身份。这是长期方向。
- **依赖**: ANP SDK 成熟度

### 用户认证/鉴权
- **来源**: eng review
- **描述**: MVP 信任用户，无认证。后续需加认证防止身份伪造和数据投毒。
- **依赖**: 无

### ~~正式部署（VPS/云）~~ ✅ 已完成
- **来源**: codex review
- **描述**: ~~本地 + tunnel 不适合生产。~~ 已部署到阿里云 ECS（华北2 北京），systemd 管理。
- **完成时间**: 2026-04-12

## P2 - 中优先级

### get_attendees 分页支持
- **来源**: eng review
- **描述**: 大活动（>100人）时全量返回会撑爆 LLM context window。需要分页或 limit 参数。
- **依赖**: 无

### search_attendees 平台端语义搜索
- **来源**: CEO plan（被移除的 MVP 功能）
- **描述**: 在平台端做语义搜索，而不是客户端 Agent 全量遍历。
- **依赖**: 分页支持

### 联系请求流程（隐私保护模式）
- **来源**: eng review（被简化掉的功能）
- **描述**: MVP 直接暴露联系方式。后续可加"发起联系"解锁模式，保护隐私。
- **依赖**: 通知机制

### REST API 层
- **来源**: eng review
- **描述**: MVP 全走 MCP。后续前端/管理后台需要 REST API。
- **依赖**: 无

### 跨活动记忆
- **来源**: CEO plan（deferred）
- **描述**: 跨多个活动记住用户社交关系，提醒"你在上次活动认识了张三"。
- **依赖**: 持久身份（ANP DID）

### 活动管理（关闭/撤销邀请码）
- **来源**: codex review
- **描述**: 活动生命周期管理：关闭活动、撤销邀请码、查看统计。
- **依赖**: 用户认证

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
