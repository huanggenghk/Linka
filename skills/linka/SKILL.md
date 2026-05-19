---
name: linka
description: Bind a user's Linka account to this agent with a one-time binding code, then store the returned agent token for future Linka API calls.
---

# Linka Skill

Use this skill when the user asks to bind, connect, or authorize their Linka account with a binding code from the Linka mini program.

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

## Token Handling

The script stores the returned `agent_token` locally with file mode `0600`. Do not print the full token in chat. If you need to confirm it exists, mention only the token file path.
