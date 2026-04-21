# Migration: /root/Linka/data → /var/lib/linka (2026-04-22)

## Why

v1.0.2.0 部署时 rsync `--delete` 清掉了 SQLite WAL 文件，导致未 checkpoint 的写入丢失（用户创建的活动数据没了）。根因是数据目录放在代码目录里，部署工具有能力碰它。修复分两层：

- **Layer 1 (v1.0.3.1)**：rsync `--exclude='data/'` 整目录排除。防御性，依赖维护者不手抖改回去。
- **Layer 2 (this)**：数据搬到 `/var/lib/linka/`，物理离开代码目录，rsync 根本触不到。

## Steps executed

1. `install -d -m 0755 /var/lib/linka /var/lib/linka/backups`
2. 记录源端行数基线（events/users/agents）
3. SQLite `.backup` 从 `/root/Linka/data/linka.db` 到 `/var/lib/linka/linka.db`（在线一致快照，含 WAL，应用不用停）
4. `PRAGMA integrity_check` 返回 `ok`
5. 目标端三张表行数与基线完全一致
6. 备份现有 systemd unit 到 `linka.service.bak-<timestamp>`
7. `sed -i` 改 `Environment=DB_PATH=/var/lib/linka/linka.db`
8. `systemctl daemon-reload && systemctl restart linka.service`
9. `/health` = `{"status":"ok"}`
10. `/api/stats` 计数与基线一致
11. `lsof /var/lib/linka/linka.db` 显示服务进程 PID，证明新 DB 被打开（非旧路径）
12. 插入 probe 事件 `ISOPROBE`，`/card/ISOPROBE.png` 返回 200 + 1440×891 PNG，然后删除 probe
13. 归档旧目录为 `/root/Linka/data.archived-2026-04-22`，保留 7 天作 rollback 保险

## Rollback

7 天归档窗口期内可回退：

```bash
ssh root@123.56.163.63 "
  # 1. 停应用
  systemctl stop linka.service

  # 2. 恢复旧目录
  mv /root/Linka/data.archived-2026-04-22 /root/Linka/data

  # 3. 恢复 systemd unit
  cp /etc/systemd/system/linka.service.bak-<TIMESTAMP> /etc/systemd/system/linka.service
  systemctl daemon-reload

  # 4. 启应用
  systemctl start linka.service
  curl -s http://localhost:3000/health
"
```

归档删除后无法 rollback，以新 DB 为 source of truth。

## Invariant after migration

部署流程（rsync / git clean / 任何在 `/root/Linka/` 下的 `rm`）**不可能**影响生产数据。唯一能动 `/var/lib/linka/` 的是：

1. 应用进程自己（读写 DB）
2. DBA 手动 ssh 操作（备份、维护、迁移）

Layer 1 的 rsync `--exclude='data/'` 作为第二重防御保留在 `docs/deployment.md`，即便有人把数据搬回代码目录也不会立即丢数据。
