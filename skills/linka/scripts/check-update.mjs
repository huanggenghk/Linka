#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));

const skillRoot = resolve(args["skill-root"] || process.env.LINKA_SKILL_ROOT || defaultSkillRoot);
const stateDir = resolve(
  expandHome(args["state-dir"] || process.env.LINKA_SKILL_STATE_DIR || "~/.linka/skill-update")
);
const cacheFile = resolve(stateDir, "last-update-check");
const markerFile = resolve(stateDir, "just-updated-from");
const snoozeFile = resolve(stateDir, "update-snoozed");
const localVersionFile = resolve(skillRoot, "VERSION");

main().catch(() => {
  process.exit(0);
});

async function main() {
  await mkdir(stateDir, { recursive: true });

  if (args.force) {
    await rm(cacheFile, { force: true });
  }

  const local = await readVersion(localVersionFile);
  if (!local) return;

  if (args.snooze) {
    const version = args.snooze === "true" ? await remoteVersion(local) : args.snooze;
    await writeSnooze(version);
    return;
  }

  if (existsSync(markerFile)) {
    const old = (await readFile(markerFile, "utf8")).trim();
    await rm(markerFile, { force: true });
    await rm(snoozeFile, { force: true });
    await writeFile(cacheFile, `UP_TO_DATE ${local}\n`);
    if (old) console.log(`JUST_UPDATED ${old} ${local}`);
    return;
  }

  const cached = await readText(cacheFile);
  if (cached && !(await isCacheStale(cacheFile, cached))) {
    const cachedLine = cached.trim();
    const [kind, old, next] = cachedLine.split(/\s+/);
    if (kind === "UP_TO_DATE" && old === local) return;
    if (kind === "UPDATE_AVAILABLE" && old === local && next) {
      if (!(await isSnoozed(next))) console.log(cachedLine);
      return;
    }
  }

  const remote = await remoteVersion(local);
  if (!isVersion(remote)) {
    await writeFile(cacheFile, `UP_TO_DATE ${local}\n`);
    return;
  }

  if (remote === local) {
    await writeFile(cacheFile, `UP_TO_DATE ${local}\n`);
    return;
  }

  const line = `UPDATE_AVAILABLE ${local} ${remote}`;
  await writeFile(cacheFile, `${line}\n`);
  if (!(await isSnoozed(remote))) console.log(line);
}

async function remoteVersion(fallback) {
  if (args["remote-version"]) return String(args["remote-version"]).trim();
  if (process.env.LINKA_SKILL_REMOTE_VERSION) {
    return process.env.LINKA_SKILL_REMOTE_VERSION.trim();
  }

  const remoteUrl = remoteVersionUrl();
  const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return fallback;
  return (await response.text()).trim();
}

function remoteVersionUrl() {
  if (args["remote-url"]) return String(args["remote-url"]);
  if (process.env.LINKA_SKILL_REMOTE_VERSION_URL) {
    return process.env.LINKA_SKILL_REMOTE_VERSION_URL;
  }

  const ref = args.ref || process.env.LINKA_SKILL_REF || "codex/mini-wx-latest";
  return `https://raw.githubusercontent.com/huanggenghk/Linka/${ref}/skills/linka/VERSION`;
}

async function readVersion(path) {
  const value = await readText(path);
  const version = value.trim();
  return isVersion(version) ? version : "";
}

async function readText(path) {
  return readFile(path, "utf8").catch(() => "");
}

async function isCacheStale(path, content) {
  const stat = await import("node:fs/promises").then((fs) => fs.stat(path)).catch(() => null);
  if (!stat) return true;

  const kind = content.trim().split(/\s+/)[0];
  const ttlMinutes = kind === "UPDATE_AVAILABLE" ? 720 : 60;
  return Date.now() - stat.mtimeMs > ttlMinutes * 60 * 1000;
}

async function isSnoozed(remoteVersion) {
  const value = await readText(snoozeFile);
  if (!value) return false;

  const [version, rawLevel, rawEpoch] = value.trim().split(/\s+/);
  const level = Number(rawLevel);
  const epoch = Number(rawEpoch);
  if (version !== remoteVersion || !Number.isInteger(level) || !Number.isInteger(epoch)) {
    return false;
  }

  const duration = level === 1 ? 86400 : level === 2 ? 172800 : 604800;
  return Math.floor(Date.now() / 1000) < epoch + duration;
}

async function writeSnooze(version) {
  const existing = await readText(snoozeFile);
  let level = 1;
  if (existing) {
    const [existingVersion, rawLevel] = existing.trim().split(/\s+/);
    if (existingVersion === version && /^\d+$/.test(rawLevel || "")) {
      level = Math.min(Number(rawLevel) + 1, 3);
    }
  }
  await writeFile(snoozeFile, `${version} ${level} ${Math.floor(Date.now() / 1000)}\n`);
}

function isVersion(value) {
  return /^[0-9]+(?:\.[0-9]+)+$/.test(value);
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

function expandHome(path) {
  const value = String(path);
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
  return value;
}
