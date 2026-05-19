# 微信真实登录方案 — 2026-05-19

## 结论

mini-wx 从 mock 微信用户 ID 切换为真实微信登录。小程序通过 `wx.login` 获取一次性 `code`，Linka 后端使用微信 `code2Session` 换取当前小程序下的 `openid`，并签发 Linka 自有 `session_token`。后续绑定、查询、解除绑定、发起建联、确认建联和连接列表 API 都使用 `Authorization: Bearer <session_token>`。

`openid` 只在服务端作为 `wechat_users.id` 保存，不暴露给小程序页面。自动化测试仍允许 `X-Mock-Wechat-User-Id`，但该 header 只在 `NODE_ENV=test` 或显式设置 `ALLOW_MOCK_WECHAT_AUTH=1` 时生效，生产默认不接受 mock 身份。

## 用户流程

1. 用户打开 Linka 小程序。
2. 小程序调用 `wx.login` 获取 `code`。
3. 小程序调用 `POST /api/wechat/login`，提交 `{ code }`。
4. 后端读取 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`，调用微信 `code2Session`。
5. 后端拿到 `openid` 后 upsert `wechat_users`，生成 30 天有效的 `session_token`。
6. 小程序把 `session_token` 存到本地 storage。
7. 后续小程序 API 请求统一携带 `Authorization: Bearer <session_token>`。
8. 如果服务端返回 401，小程序清理旧 token，重新 `wx.login` 并重试一次。

## API

### `POST /api/wechat/login`

小程序调用。

输入：

- `code`: `wx.login` 返回的一次性 code。

返回：

- `session_token`: Linka 自有小程序会话 token。
- `expires_at`: 会话过期时间。

错误：

- 400：请求参数无效。
- 500：服务端缺少 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`。
- 502：微信登录服务不可用或 code 无效。

### 小程序业务 API 鉴权

以下接口都要求请求头：

- `Authorization: Bearer <session_token>`

接口：

- `POST /api/agent-bindings/sessions`
- `GET /api/agent-bindings/current`
- `DELETE /api/agent-bindings/current`
- `POST /api/direct-shares`
- `POST /api/direct-shares/:share_id/accept`
- `GET /api/direct-edges`

`GET /api/direct-shares/:share_id` 支持未登录访问，未登录时 `viewer_status` 按 `unbound` 处理；如果传入无效 token，则返回 401。

## 数据模型

- `wechat_users`: `id` 为微信小程序 `openid`。
- `wechat_login_sessions`: 保存 `session_token` 的 SHA-256 hash、对应 `wechat_user_id` 和过期时间。
- `binding_sessions`、`agent_bindings`、`direct_shares`、`direct_edges`: 继续通过 `wechat_user_id` 关联真实微信用户。

## 部署配置

线上 `linka.service` 必须配置：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`

小程序真机测试还要求微信小程序后台把 `https://linka.zone` 加入 request 合法域名。

## 实施边界

- 本阶段使用 `openid` 作为当前小程序内的真实微信身份，不接手机号、昵称、头像和 unionid。
- `session_token` 仅用于小程序业务 API，不替代 Agent 的 `agent_token`。
- 自动化测试继续用受控 mock header，避免测试依赖微信外网和真实小程序密钥。
