# Linka Skill 更新机制方案 — 2026-05-19

## 结论

Linka Skill 采用参考 gstack 的轻量自更新机制：

- `skills/linka/VERSION` 声明当前 Skill 版本。
- `skills/linka/scripts/check-update.mjs` 做周期性版本检查。
- `skills/linka/scripts/update-skill.mjs` 执行 vendored Skill 更新。
- `skills/linka/SKILL.md` 的 Preamble 在 Skill 使用时先检查更新。

机制和 gstack 保持同形：有本地版本、远端版本、缓存、snooze、just-updated marker。差异是 Linka 更保守：如果检测到 Skill 位于完整 Git 工作区内，不执行 reset 或覆盖仓库，避免误伤产品代码和未提交改动。

## 行为规则

### 检查更新

`check-update.mjs` 输出约定：

- `UPDATE_AVAILABLE <old> <new>`：远端版本和本地版本不同。
- `JUST_UPDATED <old> <new>`：刚完成一次更新。
- 无输出：已是最新、被 snooze、检查失败或暂时跳过。

默认远端版本地址：

```text
https://raw.githubusercontent.com/huanggenghk/Linka/<ref>/skills/linka/VERSION
```

当前默认 `<ref>` 为 `codex/mini-wx-latest`。可用 `LINKA_SKILL_REF` 或 `LINKA_SKILL_REMOTE_VERSION_URL` 覆盖。

### 缓存和 snooze

状态目录：

```text
~/.linka/skill-update/
```

文件：

- `last-update-check`: 最近一次检查结果。
- `update-snoozed`: 用户暂缓更新的版本、级别和时间戳。
- `just-updated-from`: 更新完成后给下一次 Preamble 展示的 marker。

TTL：

- 已最新：60 分钟。
- 有更新：720 分钟。
- snooze 退避：24 小时、48 小时、7 天。

### 执行更新

`update-skill.mjs` 支持两类安装：

- `vendored`: 直接复制安装的 Skill。脚本会 clone Linka 仓库，只替换 `skills/linka` 目录。
- `source-git`: 当前 Skill 位于完整 Linka Git 工作区。脚本拒绝自动更新，并提示使用普通 Git 流程更新。

这个限制是刻意设计：Linka 仓库同时包含后端、小程序和文档，不能让 Skill 自更新脚本对整个工作区执行破坏性操作。

## Skill Preamble

每次触发 Linka Skill 时，先运行：

```bash
node skills/linka/scripts/check-update.mjs
```

如果发现 `UPDATE_AVAILABLE`：

- `LINKA_AUTO_SKILL_UPDATE=1` 时自动运行 `update-skill.mjs`。
- 否则询问用户是否更新。
- 用户拒绝时运行 `check-update.mjs --snooze <new>`。

## 环境变量

- `LINKA_SKILL_ROOT`: 覆盖 Skill 根目录。
- `LINKA_SKILL_STATE_DIR`: 覆盖更新状态目录。
- `LINKA_SKILL_REMOTE_VERSION`: 测试用，直接指定远端版本。
- `LINKA_SKILL_REMOTE_VERSION_URL`: 覆盖远端 VERSION URL。
- `LINKA_SKILL_REPO`: 覆盖更新使用的 Git 仓库 URL。
- `LINKA_SKILL_REF`: 覆盖远端分支或 tag。
- `LINKA_AUTO_SKILL_UPDATE=1`: 启用自动更新。

## 后置

- 代码合并到主分支后，将默认 `LINKA_SKILL_REF` 调整为 `main`。
- 如果未来发布独立 Skill 包，可以把 vendored 更新源从完整 Linka 仓库切到更小的 Skill-only 仓库。
