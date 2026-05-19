# 微信小程序绑定 Agent 技术方案 — 2026-05-19

## 结论

mini-wx 阶段固定采用“Linka Skill 调 REST API 完成绑定”的方案。首次绑定不走 MCP。

当前实现的 MVP 已交付真实微信登录、私聊 Agent 绑定闭环和私聊双方建边：小程序通过 `wx.login` 建立真实微信身份，生成绑定码；Skill 认领并保存 `agent_token`；小程序显示已连接并支持私聊建联。群聊网络后置。

绑定的本质是建立一条可信关系：

> 这个微信用户授权了这个 Agent Skill 代表自己维护 Linka 社交链接。

微信小程序负责确认用户身份、生成一次性绑定码。Linka Skill 负责拿绑定码调用 Linka API，证明自己是用户刚刚授权的助手。

## 绑定流程

1. 用户在微信小程序点击“连接我的 AI 助手”。
2. 小程序通过微信登录确认用户身份，Linka 后端拿到当前小程序下的微信 `openid`。
3. Linka 后端创建一个 `binding_session`，生成一次性 `binding_code`，默认 10 分钟过期，只能使用一次。
4. 小程序展示并复制一段绑定文案，例如：“请使用 Linka Skill 绑定我的账号，绑定码是 XXXX。”
5. 用户把这段文案发给自己的 Agent，触发 Linka Skill。
6. Linka Skill 调用 `POST /api/agent-bindings/claim`，提交绑定码和 Agent 信息。
7. Linka 后端校验绑定码未过期、未使用，并把微信用户与该 Agent Skill 实例绑定。
8. 后端返回 `agent_token`。
9. Linka Skill 保存 `agent_token`，后续用它调用 Linka API 更新状态、建立连接、查询上下文。
10. 小程序轮询或刷新绑定状态，显示“已连接你的 AI 助手”。

## API 边界

### 创建绑定会话

由小程序调用。

`POST /api/agent-bindings/sessions`

输入：
- 微信用户登录态

输出：
- `binding_code`
- `expires_at`
- `copy_prompt`

### 认领绑定

由 Linka Skill 调用。

`POST /api/agent-bindings/claim`

输入：
- `binding_code`
- `agent_platform`
- `agent_name`
- `skill_instance_id`（如果平台可提供）

输出：
- `agent_token`
- `wechat_user_id`
- `bound_at`

### 查询绑定状态

由小程序调用。

`GET /api/agent-bindings/current`

输出：
- `status`: `unbound` / `pending` / `bound`
- `agent_platform`
- `agent_name`
- `bound_at`

## 安全约束

- `binding_code` 必须短期有效，默认 10 分钟。
- `binding_code` 必须一次性使用，认领成功后立即失效。
- `binding_code` 不等同于长期凭证，泄露影响只限当前绑定窗口。
- `agent_token` 是长期凭证，必须只返回给 Skill，不能展示在小程序里。
- 用户可以在小程序里解除绑定，使旧 `agent_token` 失效。
- 后续敏感操作应基于 `agent_token` 的授权范围控制，而不是继续依赖绑定码。

## 为什么不走 MCP

MCP 适合第一版的活动工具调用，但首次绑定更像账号初始化。它只需要普通 HTTPS API，不需要 MCP 协议参与。

这个方案的优势：
- 小程序和 Skill 都能理解普通 REST API。
- 绑定流程更短，不要求用户先配置 MCP。
- 不把 v2 的微信入口绑死在 MCP 客户端能力上。
- MCP 可以继续服务 v1 活动工具，v2 绑定走独立 REST API。

## 风险和降级

最大风险是不同 Agent 平台的 Skill 能力不一致，尤其是长期 token 存储和后台主动执行能力。

降级策略：
- 如果 Skill 不能安全保存 `agent_token`，则使用较短有效期 token，并在需要时重新绑定或重新授权。
- 如果平台不支持后台主动执行，仍可先支持用户触发式状态更新。
- 如果平台不能提供稳定 `skill_instance_id`，先用 `agent_platform + agent_name + token` 建立绑定，不把它作为安全身份来源。

## 固定决策

- mini-wx 首次绑定采用小程序绑定码 + Linka Skill REST API 认领。
- MCP 不参与首次绑定路径。
- 绑定成功后，Skill 用 `agent_token` 调用 Linka API 维护用户的可连接状态。
