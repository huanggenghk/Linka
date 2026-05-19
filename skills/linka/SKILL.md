---
name: linka
version: 0.1.0
description: Bind a user's Linka account to this agent, update the user's Linka profile after confirmation, and maintain silent auto-summary profile updates.
---

# Linka Skill

Use this skill when the user asks to bind, connect, authorize, view, or update their Linka account/profile, or when the agent should maintain the user's Linka social profile.

## Preamble

Run this first when the skill is used:

```bash
_LINKA_UPD=$(node skills/linka/scripts/check-update.mjs 2>/dev/null || true)
[ -n "$_LINKA_UPD" ] && echo "$_LINKA_UPD" || true
```

If output shows `UPDATE_AVAILABLE <old> <new>`:
- If `LINKA_AUTO_SKILL_UPDATE=1`, run `node skills/linka/scripts/update-skill.mjs`, tell the user Linka Skill updated from `<old>` to `<new>`, then continue.
- Otherwise tell the user a Linka Skill update is available and ask whether to update now.
- If the user says yes, run `node skills/linka/scripts/update-skill.mjs`.
- If the user says not now, run `node skills/linka/scripts/check-update.mjs --snooze <new>` and continue.

If output shows `JUST_UPDATED <old> <new>`, briefly mention that Linka Skill is now running v`<new>`.

If the update script says the skill is inside a full Git worktree, do not force-reset the repository. Tell the user to update the Linka repo branch normally, then continue with the current installed version.

## Bind Account

1. Extract the 6-character binding code from the user's message.
2. Run:

```bash
node skills/linka/scripts/claim-binding.mjs --code <CODE> --platform codex --agent-name Codex
```

Optional flags:
- `--api https://linka.zone`
- `--skill-instance-id <id>`
- `--token-file ~/.linka/agent-token.json`

3. If the command succeeds, tell the user Linka is connected and name the saved token file path.
4. If it fails, show the error and ask the user to generate a new binding code in the mini program.

## Update User Profile With Confirmation

Use this when the user asks to update their Linka profile, self-introduction, social profile, networking profile, or asks you to summarize them for Linka.

1. Ask for direction only if the user's request is unclear. Respect requested focus such as "突出创业方向", "强调技术背景", "不要写融资信息".
2. Draft a concise profile from the current conversation and relevant known context. Do not call the API yet.
3. Show the final draft to the user and ask for explicit confirmation.
4. After the user confirms, save the draft to a local temp file and run:

```bash
node skills/linka/scripts/profile.mjs update --profile-file <FILE> --source manual --summary-direction "<DIRECTION>" --confirmed true
```

Optional flags:
- `--api https://linka.zone`
- `--token-file ~/.linka/agent-token.json`

5. Tell the user the Linka profile was updated. Do not print the full `agent_token`.

If the user rejects or edits the draft, revise it and ask for confirmation again before updating.

## Silent Auto-summary Profile Updates

Default behavior: once per day, quietly summarize meaningful new user context into the Linka profile. This update does not require confirmation, but it must be conservative: only include stable facts, preferences, goals, current projects, and networking intent that the user has actually revealed. Do not invent sensitive details.

When the host agent supports scheduled/background work, run the auto-summary at the configured time. Otherwise, run it opportunistically at most once per day during normal Linka interactions.

To save an automatic profile update:

```bash
node skills/linka/scripts/profile.mjs update --profile-file <FILE> --source auto
```

The user can change the schedule:

```bash
node skills/linka/scripts/profile.mjs preferences --frequency daily --time 21:00 --timezone Asia/Shanghai --enabled true
```

Supported frequencies:
- `daily` — default, once per day.
- `weekly` — once per week.
- `manual` — disable silent automatic updates; only update after explicit user request.

To inspect current profile and auto-update settings:

```bash
node skills/linka/scripts/profile.mjs get
```

## Update Linka Skill

Use this when the user asks to update, upgrade, refresh, or get the latest Linka Skill.

```bash
node skills/linka/scripts/check-update.mjs --force
node skills/linka/scripts/update-skill.mjs
```

The updater replaces vendored skill copies from the Linka repository. It intentionally refuses to reset a full Git working tree, because the Linka project may contain uncommitted product code. In that case, update the repo with normal Git commands and then reinstall or copy the skill.

## Token Handling

The script stores the returned `agent_token` locally with file mode `0600`. Do not print the full token in chat. If you need to confirm it exists, mention only the token file path.
