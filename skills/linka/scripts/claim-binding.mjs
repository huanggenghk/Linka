#!/usr/bin/env node
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const args = parseArgs(process.argv.slice(2));
const code = required(args.code, "--code");
const apiBase = stripTrailingSlash(args.api || process.env.LINKA_API_BASE || "https://linka.zone");
const platform = args.platform || "codex";
const agentName = args["agent-name"] || "Codex";
const skillInstanceId = args["skill-instance-id"];
const tokenFile = expandHome(args["token-file"] || "~/.linka/agent-token.json");

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});

async function main() {
  const response = await fetch(`${apiBase}/api/agent-bindings/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      binding_code: code,
      agent_platform: platform,
      agent_name: agentName,
      skill_instance_id: skillInstanceId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
    throw new Error(`Linka binding failed: ${message}`);
  }

  await mkdir(dirname(tokenFile), { recursive: true });
  await writeFile(
    tokenFile,
    JSON.stringify(
      {
        api_base: apiBase,
        agent_token: data.agent_token,
        wechat_user_id: data.wechat_user_id,
        bound_at: data.bound_at,
        agent_platform: platform,
        agent_name: agentName,
      },
      null,
      2
    )
  );
  await chmod(tokenFile, 0o600);

  console.log(
    JSON.stringify(
      {
        ok: true,
        token_file: tokenFile,
        wechat_user_id: data.wechat_user_id,
        bound_at: data.bound_at,
      },
      null,
      2
    )
  );
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const key = rawArgs[i];
    if (!key.startsWith("--")) continue;
    const value = rawArgs[i + 1];
    if (!value || value.startsWith("--")) {
      parsed[key.slice(2)] = "true";
      continue;
    }
    parsed[key.slice(2)] = value;
    i += 1;
  }
  return parsed;
}

function required(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required`);
  }
  return String(value).trim().toUpperCase();
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/$/, "");
}

function expandHome(path) {
  const value = String(path);
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
  return resolve(value);
}
