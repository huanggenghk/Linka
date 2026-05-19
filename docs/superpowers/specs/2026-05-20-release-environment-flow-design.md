# 开发-测试-生产发布流程 — 2026-05-20

## 决策

Linka 从 2026-05-20 起采用环境隔离发布流程：

- 功能分支只能部署到测试环境。
- 生产环境只能从 `main` 部署。
- 任何数据库破坏性变更、线上 API 移除、身份或绑定流程变更，都必须先经过测试环境验证，再合并 `main`，最后部署生产。

这条规则是项目级协作规则，写入 `AGENTS.md`、`CLAUDE.md` 和部署文档。后续默认执行，不需要每次重新确认。

## 环境

| 环境 | Git 来源 | 服务 | 端口 | 代码目录 | 数据库 | 外部入口 |
|---|---|---|---|---|---|---|
| 测试 | 任意干净功能分支 | `linka-test.service` | `3001` | `/root/Linka-test` | `/var/lib/linka-test/linka-test.db` | `https://linka.zone/test-api` |
| 生产 | 只允许 `main` | `linka.service` | `3000` | `/root/Linka` | `/var/lib/linka/linka.db` | `https://linka.zone` |

测试环境和生产环境共享同一台 ECS、同一个 Nginx、同一份微信小程序密钥文件，但代码目录、进程端口和 SQLite 数据库完全隔离。

## 标准流程

1. 从最新 `main` 创建 `codex/*` 功能分支。
2. 在功能分支开发并同步文档。
3. 本地必须通过：

```bash
pnpm build
pnpm mini:check
pnpm test
```

4. 提交并推送功能分支。
5. 部署测试环境：

```bash
pnpm deploy:test
```

6. 验证测试环境：

```bash
curl https://linka.zone/test-api/health
```

7. 小程序测试时，把 API 地址设为 `https://linka.zone/test-api`。
8. CEO 确认测试环境结果后，合并到 `main`。
9. 在干净 `main` 上部署生产：

```bash
pnpm deploy:prod
```

10. 验证生产环境：

```bash
curl https://linka.zone/health
```

## 禁止事项

- 禁止从功能分支直接部署生产。
- 禁止在未合并 `main` 的情况下让生产环境长期运行功能分支代码。
- 禁止把未提交、未跟踪、本地 IDE 配置或小程序私有配置带入部署。
- 禁止生产和测试共用 SQLite 数据库。
- 禁止破坏性 schema 变更跳过测试环境。

## 破坏性变更附加要求

涉及 `DROP TABLE`、删除线上 API、token 失效、登录/绑定语义变化时，必须额外完成：

- 记录方案文档。
- 明确回滚策略。
- 部署前备份生产数据库。
- 测试环境验证旧入口行为和新主路径行为。
- 生产部署后验证健康检查、核心 API、已退役入口状态和数据库结构。

## 工具保护

`scripts/deploy-backend.sh` 是后端部署唯一默认入口：

- 部署前要求工作区干净。
- `prod` 目标强制要求当前分支是 `main`。
- 每次部署都会先清理并重建 `dist`，避免旧构建产物残留。
- `test` 和 `prod` 使用不同远端目录、systemd 服务、端口和数据库。
