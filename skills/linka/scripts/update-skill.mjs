#!/usr/bin/env node
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";
import { promisify } from "node:util";

const exec = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));

const skillRoot = resolve(args["skill-root"] || process.env.LINKA_SKILL_ROOT || defaultSkillRoot);
const stateDir = resolve(
  expandHome(args["state-dir"] || process.env.LINKA_SKILL_STATE_DIR || "~/.linka/skill-update")
);
const repoUrl = args.repo || process.env.LINKA_SKILL_REPO || "https://github.com/huanggenghk/Linka.git";
const ref = args.ref || process.env.LINKA_SKILL_REF || "codex/mini-wx-latest";

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});

async function main() {
  const oldVersion = await readVersion(resolve(skillRoot, "VERSION"));
  const install = await detectInstallType(skillRoot);

  if (args["dry-run"]) {
    print({
      ok: true,
      dry_run: true,
      install_type: install.type,
      skill_root: skillRoot,
      old_version: oldVersion,
      ref,
      repo: repoUrl,
    });
    return;
  }

  if (install.type === "source-git") {
    throw new Error(
      "当前 Linka Skill 位于完整 Git 工作区内。为避免覆盖项目改动，请在仓库里用 git pull / git fetch 更新；不要用 skill 自更新脚本重置整个项目。"
    );
  }

  const tmp = await mkdtemp(resolve(tmpdir(), "linka-skill-update-"));
  const backup = `${skillRoot}.bak.${Date.now()}`;
  try {
    await exec("git", ["clone", "--depth", "1", "--branch", ref, repoUrl, resolve(tmp, "Linka")], {
      maxBuffer: 10 * 1024 * 1024,
    });

    const freshSkill = resolve(tmp, "Linka", "skills", "linka");
    if (!existsSync(resolve(freshSkill, "SKILL.md"))) {
      throw new Error("远端仓库里没有找到 skills/linka/SKILL.md");
    }

    await rename(skillRoot, backup);
    await cp(freshSkill, skillRoot, { recursive: true });
    await rm(backup, { recursive: true, force: true });

    const newVersion = await readVersion(resolve(skillRoot, "VERSION"));
    await writeUpgradeMarker(oldVersion);
    print({
      ok: true,
      install_type: install.type,
      skill_root: skillRoot,
      old_version: oldVersion,
      new_version: newVersion,
    });
  } catch (error) {
    if (!existsSync(skillRoot) && existsSync(backup)) {
      await rename(backup, skillRoot);
    }
    throw error;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function detectInstallType(root) {
  try {
    const { stdout } = await exec("git", ["-C", root, "rev-parse", "--show-toplevel"]);
    const gitRoot = resolve(stdout.trim());
    const expected = resolve(gitRoot, "skills", "linka");
    if (expected === root) {
      return { type: "source-git", git_root: gitRoot };
    }
  } catch {
    // Not a git install.
  }
  return { type: "vendored" };
}

async function readVersion(path) {
  const value = await readFile(path, "utf8").catch(() => "unknown");
  return value.trim() || "unknown";
}

async function writeUpgradeMarker(oldVersion) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(resolve(stateDir, "just-updated-from"), `${oldVersion}\n`);
  await rm(resolve(stateDir, "last-update-check"), { force: true });
  await rm(resolve(stateDir, "update-snoozed"), { force: true });
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

function print(data) {
  console.log(JSON.stringify(data, null, 2));
}
