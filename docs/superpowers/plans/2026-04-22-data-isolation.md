# Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保证后续每次部署都无法影响已有数据。把 SQLite 从 `/root/Linka/data/linka.db` 迁出到 `/var/lib/linka/linka.db`，让代码目录与数据目录物理分离；并锁定防御性 rsync 规则。

**Architecture:** 分两层。防御层（Layer 1）：rsync 必须 `--exclude='data/'`，且不能再引用或写 `/root/Linka/data/`——已在 v1.0.3.1 实现，本计划只做验证。隔离层（Layer 2）：把运行时数据迁到 Linux 惯例的 `/var/lib/linka/`，修改 systemd `DB_PATH` 环境变量。应用代码无需改动，因为 `createDb()` 已经是 env-driven（[src/db/index.ts:35](../../../src/db/index.ts#L35)）。迁移用 SQLite `.backup` 命令（在线一致快照，应用不用停），迁移后做 `PRAGMA integrity_check` + 行数比对校验。

**Tech Stack:** SQLite (better-sqlite3, WAL 模式) · systemd · Ubuntu 22.04 · bash

---

## File Structure

- **Modify:** `/etc/systemd/system/linka.service` (on server) — 改 `DB_PATH` 环境变量
- **Modify:** [docs/deployment.md](../../../docs/deployment.md) — 目录结构表、systemd 示例、所有 `/root/Linka/data/` 引用
- **Modify:** [README.md](../../../README.md) — "服务器信息"一节里的 DB 路径
- **Create:** [docs/migrations/2026-04-22-data-to-var-lib.md](../../../docs/migrations/2026-04-22-data-to-var-lib.md) — 迁移 runbook，留档
- **Bump:** [VERSION](../../../VERSION) · [CHANGELOG.md](../../../CHANGELOG.md)
- **Unchanged:** `src/` — `DB_PATH` 已经是 env var，应用代码不动
- **Unchanged:** `test/` — 测试用 `:memory:`，不受影响

---

## Task 1: 验证 Layer 1（防御）已生效

**Files:**
- Read: [docs/deployment.md](../../../docs/deployment.md)

- [ ] **Step 1: 确认 deployment.md 的两段 rsync 都用 `--exclude='data/'`**

Run:
```bash
grep -n "exclude=" docs/deployment.md | grep -i data
```
Expected: 两行都是 `--exclude='data/'`，没有 `data/*.db`。

- [ ] **Step 2: 确认 main 分支上 v1.0.3.1 已包含此修复**

Run:
```bash
git log origin/main --oneline | head -5
git show origin/main:docs/deployment.md | grep -n "exclude=" | grep data
```
Expected: 看到 v1.0.3.1 的 squash commit；两行都是 `data/` 整目录排除。

- [ ] **Step 3: 迁移后再次确认（后置校验）**

迁移完成后，再次确认：旧 `/root/Linka/data/` 路径不再是任何部署脚本或 systemd unit 的依赖，即便失误把它删掉也不影响数据。——这一步归到 Task 7 的验证。

不需要 commit（只是读检查）。

---

## Task 2: 在服务器创建数据目录与权限

**Files:**
- Create on server: `/var/lib/linka/` 和 `/var/lib/linka/backups/`

- [ ] **Step 1: 创建目录**

Run:
```bash
ssh root@123.56.163.63 "install -d -m 0755 -o root -g root /var/lib/linka /var/lib/linka/backups && ls -ld /var/lib/linka /var/lib/linka/backups"
```
Expected: 两个目录以 `drwxr-xr-x root root` 出现。

使用 `install` 而非 `mkdir -p` 是因为 `install` 能一步到位设置权限和属主，避免 mkdir 后再 chmod/chown 两步的竞态。

不需要 commit（服务器侧变更）。

---

## Task 3: 一致性快照旧 DB 到新位置

**Files:**
- Source on server: `/root/Linka/data/linka.db` (+ WAL, SHM)
- Target on server: `/var/lib/linka/linka.db`

- [ ] **Step 1: 记录源端行数做校验基线**

Run:
```bash
ssh root@123.56.163.63 'node -e "
const Database = require(\"/root/Linka/node_modules/better-sqlite3\");
const db = new Database(\"/root/Linka/data/linka.db\");
db.pragma(\"journal_mode=WAL\");
const counts = {
  events: db.prepare(\"SELECT count(*) as n FROM events\").get().n,
  users: db.prepare(\"SELECT count(*) as n FROM users\").get().n,
  agents: db.prepare(\"SELECT count(*) as n FROM agents\").get().n,
};
console.log(JSON.stringify(counts));
"'
```
Expected: `{"events":N,"users":M,"agents":K}`。**把这组数字记下来**（下面 Step 4 要对比）。

- [ ] **Step 2: 用 SQLite `.backup` 做在线一致快照**

`.backup` 是 SQLite 的官方一致快照 API，会原子地把所有页面（包括未 checkpoint 的 WAL）写进目标，应用不用停。比直接 `cp` 主 DB 安全（cp 会错过 WAL）。

Run:
```bash
ssh root@123.56.163.63 'node -e "
const Database = require(\"/root/Linka/node_modules/better-sqlite3\");
const src = new Database(\"/root/Linka/data/linka.db\");
src.pragma(\"journal_mode=WAL\");
src.backup(\"/var/lib/linka/linka.db\").then(() => {
  src.close();
  console.log(\"backup ok\");
}).catch(e => { console.error(\"backup failed:\", e); process.exit(1); });
"'
```
Expected: `backup ok`。

- [ ] **Step 3: 完整性检查**

Run:
```bash
ssh root@123.56.163.63 'node -e "
const Database = require(\"/root/Linka/node_modules/better-sqlite3\");
const db = new Database(\"/var/lib/linka/linka.db\", { readonly: true });
const r = db.pragma(\"integrity_check\");
console.log(JSON.stringify(r));
"'
```
Expected: `[{"integrity_check":"ok"}]`。任何其他输出都要 **STOP**，不能继续。

- [ ] **Step 4: 行数比对**

Run:
```bash
ssh root@123.56.163.63 'node -e "
const Database = require(\"/root/Linka/node_modules/better-sqlite3\");
const db = new Database(\"/var/lib/linka/linka.db\", { readonly: true });
const counts = {
  events: db.prepare(\"SELECT count(*) as n FROM events\").get().n,
  users: db.prepare(\"SELECT count(*) as n FROM users\").get().n,
  agents: db.prepare(\"SELECT count(*) as n FROM agents\").get().n,
};
console.log(JSON.stringify(counts));
"'
```
Expected: 输出**完全等于** Step 1 记录的基线。任何差异 → STOP。

不需要 commit。

---

## Task 4: 切换 systemd unit 的 DB_PATH

**Files:**
- Modify on server: `/etc/systemd/system/linka.service`

- [ ] **Step 1: 备份当前 unit**

Run:
```bash
ssh root@123.56.163.63 "cp /etc/systemd/system/linka.service /etc/systemd/system/linka.service.bak-$(date +%Y%m%d-%H%M%S) && ls /etc/systemd/system/linka.service*"
```
Expected: 看到 `linka.service` 和带时间戳的 `.bak-*` 文件。

- [ ] **Step 2: 修改 `Environment=DB_PATH=...`**

Run:
```bash
ssh root@123.56.163.63 "sed -i 's|Environment=DB_PATH=/root/Linka/data/linka.db|Environment=DB_PATH=/var/lib/linka/linka.db|' /etc/systemd/system/linka.service && grep Environment /etc/systemd/system/linka.service"
```
Expected:
```
Environment=DB_PATH=/var/lib/linka/linka.db
Environment=PORT=3000
```

- [ ] **Step 3: `daemon-reload`，让 systemd 识别修改**

Run:
```bash
ssh root@123.56.163.63 "systemctl daemon-reload && systemctl show linka.service -p Environment | tr ' ' '\n' | grep DB_PATH"
```
Expected: `DB_PATH=/var/lib/linka/linka.db`。

不需要 commit（服务器侧变更）。

---

## Task 5: 重启服务并验证读写新 DB

**Files:** 无（纯运行时验证）

- [ ] **Step 1: 重启服务**

Run:
```bash
ssh root@123.56.163.63 "systemctl restart linka.service && sleep 2 && systemctl is-active linka.service"
```
Expected: `active`。

- [ ] **Step 2: 健康检查**

Run:
```bash
curl -s https://linka.zone/health
```
Expected: `{"status":"ok"}`。

- [ ] **Step 3: 验证读路径（用已有数据）**

Run:
```bash
curl -s https://linka.zone/api/stats
```
Expected: `events` 和 `agents` 数字与 Task 3 Step 1 的基线一致。

- [ ] **Step 4: 验证写路径 + 新 DB 文件确实被写**

插一条测试事件，然后用 `lsof` / `stat` 看 DB 文件 mtime 是否更新到新位置，再删掉测试事件。

Run:
```bash
ssh root@123.56.163.63 'node -e "
const Database = require(\"/root/Linka/node_modules/better-sqlite3\");
const db = new Database(\"/var/lib/linka/linka.db\");
db.pragma(\"journal_mode=WAL\");
db.prepare(\"INSERT INTO events (id, name, description, location, date, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)\").run(\"isolation-probe\", \"Isolation Probe\", null, null, null, \"ISOPROBE\", new Date().toISOString());
console.log(\"inserted\");
"'
sleep 1
ssh root@123.56.163.63 "lsof /var/lib/linka/linka.db 2>/dev/null | head -3"
curl -sS -o /tmp/probe.png -w "status: %{http_code} size: %{size_download}\n" "https://linka.zone/card/ISOPROBE.png"
file /tmp/probe.png
ssh root@123.56.163.63 'node -e "
const Database = require(\"/root/Linka/node_modules/better-sqlite3\");
const db = new Database(\"/var/lib/linka/linka.db\");
db.pragma(\"journal_mode=WAL\");
db.prepare(\"DELETE FROM events WHERE invite_code=?\").run(\"ISOPROBE\");
console.log(\"cleaned\");
"'
```
Expected:
- `inserted`
- `lsof` 输出里 `COMMAND` 列是 `node`，`NAME` 列是 `/var/lib/linka/linka.db` → 证明服务进程确实打开了新 DB
- `/card/ISOPROBE.png` 返回 200 + PNG（证明读路径也在新 DB）
- `cleaned`

任何一步失败 → 回滚：`sed` 把 unit 改回旧 `DB_PATH`，`systemctl daemon-reload && systemctl restart linka`。

不需要 commit。

---

## Task 6: 更新文档（代码仓）

**Files:**
- Modify: [docs/deployment.md](../../../docs/deployment.md)
- Modify: [README.md](../../../README.md)

- [ ] **Step 1: 修改 deployment.md 的目录结构表**

Edit `docs/deployment.md`，把：
```markdown
| `/root/Linka/data/linka.db` | SQLite 数据库 |
```
改为：
```markdown
| `/var/lib/linka/linka.db` | SQLite 数据库（与代码物理隔离，部署不会碰到） |
| `/var/lib/linka/backups/` | 数据库备份目录（Layer 3 未实现时为空） |
```

- [ ] **Step 2: 修改 deployment.md 的 systemd unit 示例**

Edit `docs/deployment.md`，把：
```ini
Environment=DB_PATH=/root/Linka/data/linka.db
```
改为：
```ini
Environment=DB_PATH=/var/lib/linka/linka.db
```

紧跟一段说明：
```markdown
> **为什么放 /var/lib/linka/**：让数据目录物理上离开代码目录 `/root/Linka/`，这样任何 rsync/git clean/rm -rf 的失误都碰不到数据。rsync 的 `--exclude='data/'` 只是第二重防御。
```

- [ ] **Step 3: 修改 README.md 服务器信息**

Edit `README.md`，把：
```markdown
- DB 路径: `/root/Linka/data/linka.db`
```
改为：
```markdown
- DB 路径: `/var/lib/linka/linka.db`（与代码目录隔离，部署流程物理上无法影响）
```

- [ ] **Step 4: 校对所有 DB 路径引用**

Run:
```bash
grep -rn '/root/Linka/data' . --include='*.md' 2>/dev/null | grep -v node_modules | grep -v .superpowers | grep -v .git
```
Expected: 空输出。如果有剩，继续改到空为止。

- [ ] **Step 5: Commit 文档更新**

```bash
git add docs/deployment.md README.md
git commit -m "docs: document /var/lib/linka DB isolation (Layer 2)"
```

---

## Task 7: 写迁移 runbook 留档

**Files:**
- Create: [docs/migrations/2026-04-22-data-to-var-lib.md](../../../docs/migrations/2026-04-22-data-to-var-lib.md)

- [ ] **Step 1: 创建目录（如不存在）并写 runbook**

先确认目录：
```bash
mkdir -p docs/migrations
```

写 `docs/migrations/2026-04-22-data-to-var-lib.md`，内容：

```markdown
# Migration: /root/Linka/data → /var/lib/linka (2026-04-22)

## Why

v1.0.2.0 部署时 rsync `--delete` 清掉了 SQLite WAL 文件，导致未 checkpoint 的写入丢失（用户创建的活动数据没了）。根因是数据目录放在代码目录里，部署工具有能力碰它。修复分两层：
- **Layer 1 (v1.0.3.1)**：rsync `--exclude='data/'` 整目录排除。防御性，依赖维护者不手抖改回去。
- **Layer 2 (this)**：数据搬到 `/var/lib/linka/`，物理离开代码目录，rsync 根本触不到。

## Steps executed

1. `install -d -m 0755 /var/lib/linka /var/lib/linka/backups`
2. SQLite `.backup` 从 `/root/Linka/data/linka.db` 到 `/var/lib/linka/linka.db`（在线一致快照，含 WAL）
3. `PRAGMA integrity_check` = `ok`
4. 三张表（events/users/agents）行数与迁移前完全一致
5. 改 systemd unit `Environment=DB_PATH=/var/lib/linka/linka.db`
6. `systemctl daemon-reload && systemctl restart linka.service`
7. `/health` = 200，`/api/stats` 计数不变，`lsof` 确认新 DB 被进程打开
8. 旧 `/root/Linka/data/` 保留 7 天归档（Task 8），之后删除

## Rollback (if needed)

```bash
# 把 systemd unit 改回旧 DB_PATH，重启
ssh root@123.56.163.63 "
  cp /etc/systemd/system/linka.service.bak-<TIMESTAMP> /etc/systemd/system/linka.service
  systemctl daemon-reload
  systemctl restart linka.service
"
```

旧目录在归档期间（7 天）保留，rollback 可用。归档删除后无法 rollback。

## Invariant after migration

部署流程（rsync / git clean / 任何在 `/root/Linka/` 下的 `rm`）**不可能**影响生产数据。唯一能动 `/var/lib/linka/` 的是：
1. 应用进程自己（读写 DB）
2. DBA 手动 ssh 操作（备份、维护）
```

- [ ] **Step 2: Commit runbook**

```bash
git add docs/migrations/2026-04-22-data-to-var-lib.md
git commit -m "docs: migration runbook for /var/lib/linka"
```

---

## Task 8: 归档旧目录（7 天保留期）

**Files:**
- Rename on server: `/root/Linka/data/` → `/root/Linka/data.archived-2026-04-22/`

保留旧目录 7 天作为 rollback 保险。`data/` 已被 rsync 排除，即便重命名后仍在排除列表（`data.archived-*` 不匹配 `data/`，但因为**不在新 DB_PATH 里**，应用不再读写它，将来部署时它可能被 `--delete` 清掉 — 这恰好是我们想要的：7 天后被动消失）。

- [ ] **Step 1: 重命名**

Run:
```bash
ssh root@123.56.163.63 "mv /root/Linka/data /root/Linka/data.archived-$(date +%Y-%m-%d) && ls /root/Linka/ | grep data"
```
Expected: 看到 `data.archived-2026-04-22`，没有裸 `data/`。

- [ ] **Step 2: 确认 rsync 预演不会误删 /var/lib/linka/**

做一次 dry-run 验证隔离层真的生效：
```bash
rsync -avzn --delete \
  --exclude='node_modules' --exclude='data/' --exclude='.git' \
  --exclude='web/dist' --exclude='web/node_modules' \
  --exclude='.claude/worktrees' --exclude='.superpowers' \
  /Users/hugo/Desktop/Linka/.claude/worktrees/silly-sammet-f8db80/ root@123.56.163.63:/root/Linka/ 2>&1 | grep -E 'deleting|/var/lib'
```
Expected: 任何 `deleting` 行都在 `/root/Linka/` 下，绝不应出现 `/var/lib/linka`（rsync 不可能操作目标之外的路径，这一步主要是目视确认 + 看到可能的归档目录删除日志）。如果 dry-run 显示会删除 `data.archived-*` 下的任何文件，加 `--exclude='data.archived-*'` 保护归档 7 天。

- [ ] **Step 3: 加 rsync 排除保护归档**

把 `docs/deployment.md` 两处 rsync 命令的 exclude 列表加一行：
```
  --exclude='data.archived-*' \
```

这条排除是一次性的（归档删除后可连同移除），但留着也无害——反正生产数据已经不在这里了。

- [ ] **Step 4: Commit**

```bash
git add docs/deployment.md
git commit -m "chore: exclude data.archived-* during 7-day rollback window"
```

---

## Task 9: Version bump + CHANGELOG + 合并发版

**Files:**
- Modify: [VERSION](../../../VERSION)
- Modify: [CHANGELOG.md](../../../CHANGELOG.md)

- [ ] **Step 1: Bump VERSION**

读当前 VERSION（合并时应是 `1.0.3.1`），bump 到 `1.0.4.0`（MINOR：基础设施变更，部署流程改变）。

Run:
```bash
cat VERSION
```

写入：
```
1.0.4.0
```

- [ ] **Step 2: 写 CHANGELOG 条目**

在 CHANGELOG.md 头部插入：

```markdown
## [1.0.4.0] - 2026-04-22

### Changed
- **生产数据迁移**：SQLite 数据库从 `/root/Linka/data/linka.db` 迁至 `/var/lib/linka/linka.db`，与代码目录 `/root/Linka/` 物理隔离。部署流程（rsync/git/手误 `rm -rf`）再也不可能影响生产数据
- systemd unit 的 `DB_PATH` 环境变量同步更新；deployment.md 与 README 中所有 DB 路径引用同步更新

### Added
- `docs/migrations/2026-04-22-data-to-var-lib.md`：留档迁移 runbook 与 rollback 步骤
```

- [ ] **Step 3: Commit、PR、merge、清归档**

```bash
git add VERSION CHANGELOG.md
git commit -m "chore: bump version to 1.0.4.0 (data isolation)"
git push -u origin HEAD
gh pr create --base main --title "feat: isolate SQLite DB to /var/lib/linka (Layer 2, v1.0.4.0)" --body "$(cat <<'EOF'
## Summary
v1.0.2.0 部署事故的根治。现在 SQLite 落在 /var/lib/linka/，代码目录的任何 rsync/git/rm 操作都碰不到生产数据。配套：deployment.md 同步、README 同步、迁移 runbook 留档、data.archived-* 7 天 rollback 保护。

## Verification
- PRAGMA integrity_check = ok
- events/users/agents 行数迁移前后完全一致
- lsof 确认服务进程打开的是 /var/lib/linka/linka.db
- /api/stats 计数不变，/card/:code.png 端到端返回 PNG

## Rollback
见 docs/migrations/2026-04-22-data-to-var-lib.md。7 天内可从 /root/Linka/data.archived-2026-04-22/ 恢复。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --squash --delete-branch
```

- [ ] **Step 4: 日历提醒 7 天后清归档**

这一步是 human action，写入 TODOS.md 或日历：「2026-04-29 ssh root@123.56.163.63 rm -rf /root/Linka/data.archived-2026-04-22」。

---

## Self-Review Checklist

- [x] Spec coverage: Layer 1 验证 (Task 1)、Layer 2 完整迁移 (Tasks 2-8)、版本/文档/发版 (Task 9)
- [x] 无 placeholder：每一步都有具体命令、期望输出、回滚路径
- [x] 类型/命名一致：`DB_PATH` 贯穿所有步骤；`/var/lib/linka/` 贯穿所有步骤
- [x] 每个高风险步骤（DB 迁移、systemd 改动、旧目录归档）都配了独立的验证步骤
- [x] 有 rollback 路径（systemd unit 备份 + 旧目录归档 7 天）
- [x] 幂等性：重跑 Task 2 (`install -d`) 安全；Task 4 的 sed 也幂等（匹配一次）
