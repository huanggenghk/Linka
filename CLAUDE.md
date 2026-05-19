# Linka

## 语言
用中文和用户对话。所有输出、问题、文档都用中文。

## Git 协作机制

任何已经和用户确认固定下来的产品方案、技术方案、架构决策，都必须同步到项目文档并提交到 git，方便其他人接力。

默认做法：
- 产品/技术方案写入 `docs/superpowers/specs/`，文件名使用 `YYYY-MM-DD-主题-design.md`。
- 如果该方案影响项目方向，同步更新 `README.md` 和 `TODOS.md`。
- 如果该方案影响协作规则，同步更新 `CLAUDE.md`。
- 完成文档同步后，只 stage 本次相关文件，提交并推送当前分支。
- 工作区若存在无关未跟踪文件或他人改动，不要自动纳入提交。

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
