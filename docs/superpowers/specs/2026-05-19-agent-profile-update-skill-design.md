# Linka Skill 用户画像更新方案 — 2026-05-19

## 结论

Linka Skill 新增两类画像维护能力：

1. 用户主动要求更新画像：Agent 根据用户指定方向或重点起草最终画像，必须等用户明确确认后再写入 Linka。
2. 静默自动总结更新画像：Agent 按用户配置的频次和时机，从近期对话中提取稳定信息并更新画像。默认每天 1 次。

后端新增 Agent 侧画像 API，统一使用 `agent_token` 鉴权。`agent_token` 由绑定流程返回并保存在本地安全文件。小程序微信登录态不参与 Agent 画像更新。

## 产品规则

- 手动更新必须先给用户看最终版本，并拿到确认。
- 用户可以要求总结方向、表达重点、需要避开的内容。
- 自动总结只写稳定事实、长期偏好、当前项目和明确的人脉意图。
- 自动总结不能编造敏感信息，不能把临时闲聊当成长期画像。
- 默认自动总结频次为每天 1 次，默认时间 `21:00`，默认时区 `Asia/Shanghai`。
- 用户可以把自动总结改成 `daily`、`weekly` 或 `manual`。`manual` 表示关闭静默自动更新，只保留手动确认更新。

## API

### `GET /api/agent/profile`

Agent 调用。请求头：

- `Authorization: Bearer <agent_token>`

返回：

- `profile`: 当前画像，未设置时为 `null`
- `preferences`: 自动总结配置

### `POST /api/agent/profile`

Agent 调用。请求头同上。

输入：

- `profile`: 最终画像文本
- `update_source`: `manual` / `auto`
- `summary_direction`: 用户指定的总结方向，可选
- `confirmed`: 手动更新时必须为 `true`

规则：

- `update_source=manual` 且 `confirmed !== true` 时拒绝。
- `update_source=auto` 时允许静默写入，并更新 `last_auto_updated_at`。

### `POST /api/agent/profile/preferences`

Agent 调用。请求头同上。

输入：

- `auto_update_enabled`: 是否启用自动总结
- `auto_update_frequency`: `daily` / `weekly` / `manual`
- `auto_update_time`: `HH:mm`
- `auto_update_timezone`: IANA 时区字符串

## 数据模型

- `wechat_user_profiles`: 当前微信用户的 Linka 社交画像、更新来源、总结方向、更新时间。
- `wechat_profile_preferences`: 自动总结开关、频次、时间、时区、上次自动更新时间。

## Skill 行为

仓库内 `skills/linka/scripts/profile.mjs` 提供：

- `get`: 读取当前画像和自动总结配置。
- `update`: 写入手动或自动画像。
- `preferences`: 修改自动总结配置。

Skill 说明要求 Agent：

- 手动更新前必须给用户确认。
- 自动更新时遵守频次配置；如果宿主不支持后台调度，则在正常 Linka 交互中按频次机会性执行。
- 不在对话中打印完整 `agent_token`。

## 实施边界

- 本阶段不做向量化画像、不做画像版本 diff UI。
- 本阶段不要求小程序展示或编辑画像。
- 自动调度能力取决于宿主 Agent 平台；Linka 提供偏好、更新时间记录和写入 API。
