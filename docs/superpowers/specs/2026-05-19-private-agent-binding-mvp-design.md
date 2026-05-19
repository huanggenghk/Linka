# 私聊 Agent 绑定 MVP 方案 — 2026-05-19

## 结论

mini-wx 第一阶段只做“用户把自己的 AI 助手绑定到 Linka”的最小闭环。

本阶段不做私聊双方建边、不做群聊网络、不接真实微信登录。小程序用 `X-Mock-Wechat-User-Id` 模拟微信用户身份，后端生成一次性绑定码，Linka Skill 调 REST API 认领绑定。

## 用户流程

1. 用户打开 Linka 小程序。
2. 小程序用 mock 微信用户 ID 调 `POST /api/agent-bindings/sessions`。
3. 后端生成 6 位绑定码，默认 10 分钟有效，只能使用一次。
4. 小程序展示并复制绑定文案：“请使用 Linka Skill 绑定我的账号，绑定码是 XXXX。”
5. 用户把文案发给自己的 Agent。
6. Linka Skill 调 `POST /api/agent-bindings/claim` 认领绑定码。
7. 后端返回 `agent_token`，Skill 保存到本地安全文件。
8. 小程序轮询 `GET /api/agent-bindings/current`，看到状态变为 `bound`。
9. 用户可以在小程序里解除绑定，使旧 `agent_token` 失效。

## API

### `POST /api/agent-bindings/sessions`

小程序调用。请求头必须包含：

- `X-Mock-Wechat-User-Id`: mock 微信用户 ID

返回：

- `binding_code`
- `expires_at`
- `copy_prompt`

### `POST /api/agent-bindings/claim`

Linka Skill 调用。

输入：

- `binding_code`
- `agent_platform`
- `agent_name`
- `skill_instance_id`（可选）

返回：

- `agent_token`
- `wechat_user_id`
- `bound_at`

### `GET /api/agent-bindings/current`

小程序调用。请求头必须包含 `X-Mock-Wechat-User-Id`。

返回：

- `status`: `unbound` / `pending` / `bound`
- pending 时返回绑定码和复制文案
- bound 时返回 Agent 平台、名称和绑定时间

### `DELETE /api/agent-bindings/current`

小程序调用。解除当前 mock 微信用户的活跃绑定。

## 数据模型

- `wechat_users`: 当前阶段只保存 mock 微信用户 ID。
- `binding_sessions`: 一次性绑定码、过期时间、认领时间。
- `agent_bindings`: 微信用户和 Agent Skill 实例的长期绑定，包含 `agent_token` 和撤销时间。

## 实施边界

- 不接 `wx.login` / `code2Session`。
- 不做私聊双方关系边。
- 不做群聊 `openGid` 网络。
- `agent_token` 本阶段只用于证明绑定完成，后续状态更新和建联 API 另行设计。
