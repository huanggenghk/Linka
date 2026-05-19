#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "get";
const tokenFile = expandHome(args["token-file"] || "~/.linka/agent-token.json");

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});

async function main() {
  const token = await readTokenFile(tokenFile);
  const apiBase = stripTrailingSlash(
    args.api || token.api_base || process.env.LINKA_API_BASE || "https://linka.zone"
  );

  if (command === "get") {
    const data = await request(apiBase, token.agent_token, "/api/agent/profile");
    print({ ok: true, ...data });
    return;
  }

  if (command === "update") {
    const source = args.source || "manual";
    if (!["manual", "auto"].includes(source)) {
      throw new Error("--source must be manual or auto");
    }

    const profile = await readProfileText(args);
    const confirmed = parseBoolean(args.confirmed);
    if (source === "manual" && confirmed !== true) {
      throw new Error("manual profile updates require --confirmed true");
    }

    const data = await request(apiBase, token.agent_token, "/api/agent/profile", {
      method: "POST",
      body: {
        profile,
        update_source: source,
        summary_direction: args["summary-direction"],
        confirmed,
      },
    });
    print({ ok: true, ...data });
    return;
  }

  if (command === "preferences") {
    const body = {};
    if (args.enabled !== undefined) body.auto_update_enabled = parseBoolean(args.enabled);
    if (args.frequency) body.auto_update_frequency = args.frequency;
    if (args.frequency === "manual" && args.enabled === undefined) {
      body.auto_update_enabled = false;
    }
    if (args.time) body.auto_update_time = args.time;
    if (args.timezone) body.auto_update_timezone = args.timezone;

    const data = await request(
      apiBase,
      token.agent_token,
      "/api/agent/profile/preferences",
      {
        method: "POST",
        body,
      }
    );
    print({ ok: true, ...data });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function request(apiBase, agentToken, path, options = {}) {
  if (!agentToken) {
    throw new Error(`agent_token is missing in ${tokenFile}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${agentToken}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
    throw new Error(`Linka profile request failed: ${message}`);
  }
  return data;
}

async function readTokenFile(path) {
  const raw = await readFile(path, "utf8").catch(() => {
    throw new Error(`token file not found: ${path}`);
  });
  return JSON.parse(raw);
}

async function readProfileText(parsedArgs) {
  if (parsedArgs.profile) {
    return String(parsedArgs.profile).trim();
  }
  if (parsedArgs["profile-file"]) {
    return (await readFile(resolve(String(parsedArgs["profile-file"])), "utf8")).trim();
  }
  throw new Error("--profile or --profile-file is required");
}

function parseArgs(rawArgs) {
  const parsed = { _: [] };
  for (let i = 0; i < rawArgs.length; i += 1) {
    const key = rawArgs[i];
    if (!key.startsWith("--")) {
      parsed._.push(key);
      continue;
    }

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

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`Invalid boolean value: ${value}`);
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

function print(data) {
  console.log(JSON.stringify(data, null, 2));
}
