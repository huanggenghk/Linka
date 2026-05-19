import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkScript = resolve(root, "skills/linka/scripts/check-update.mjs");
const updateScript = resolve(root, "skills/linka/scripts/update-skill.mjs");
const skillRoot = resolve(root, "skills/linka");

describe("Linka Skill update mechanism", () => {
  it("检查到远端版本不一致时应该提示可更新", async () => {
    const stateDir = await mkdtemp(resolve(tmpdir(), "linka-skill-state-"));
    const local = (await readFile(resolve(skillRoot, "VERSION"), "utf8")).trim();
    const remote = bumpPatch(local);

    const { stdout } = await exec(process.execPath, [checkScript, "--force"], {
      env: {
        ...process.env,
        LINKA_SKILL_ROOT: skillRoot,
        LINKA_SKILL_STATE_DIR: stateDir,
        LINKA_SKILL_REMOTE_VERSION: remote,
      },
    });

    expect(stdout.trim()).toBe(`UPDATE_AVAILABLE ${local} ${remote}`);
    await rm(stateDir, { recursive: true, force: true });
  });

  it("远端版本相同时应该保持静默", async () => {
    const stateDir = await mkdtemp(resolve(tmpdir(), "linka-skill-state-"));
    const local = (await readFile(resolve(skillRoot, "VERSION"), "utf8")).trim();

    const { stdout } = await exec(process.execPath, [checkScript, "--force"], {
      env: {
        ...process.env,
        LINKA_SKILL_ROOT: skillRoot,
        LINKA_SKILL_STATE_DIR: stateDir,
        LINKA_SKILL_REMOTE_VERSION: local,
      },
    });

    expect(stdout.trim()).toBe("");
    await rm(stateDir, { recursive: true, force: true });
  });

  it("刚更新后应该输出 JUST_UPDATED 并清理 marker", async () => {
    const stateDir = await mkdtemp(resolve(tmpdir(), "linka-skill-state-"));
    await writeFile(resolve(stateDir, "just-updated-from"), "0.0.1\n");
    const local = (await readFile(resolve(skillRoot, "VERSION"), "utf8")).trim();

    const { stdout } = await exec(process.execPath, [checkScript], {
      env: {
        ...process.env,
        LINKA_SKILL_ROOT: skillRoot,
        LINKA_SKILL_STATE_DIR: stateDir,
        LINKA_SKILL_REMOTE_VERSION: local,
      },
    });

    expect(stdout.trim()).toBe(`JUST_UPDATED 0.0.1 ${local}`);
    await rm(stateDir, { recursive: true, force: true });
  });

  it("更新脚本 dry-run 应该识别当前源码安装并不修改文件", async () => {
    const { stdout } = await exec(process.execPath, [updateScript, "--dry-run"], {
      env: {
        ...process.env,
        LINKA_SKILL_ROOT: skillRoot,
      },
    });

    const data = JSON.parse(stdout);
    expect(data.ok).toBe(true);
    expect(data.dry_run).toBe(true);
    expect(data.install_type).toBe("source-git");
    expect(data.skill_root).toBe(skillRoot);
  });
});

function bumpPatch(version: string) {
  const parts = version.split(".").map((part) => Number(part));
  parts[parts.length - 1] += 1;
  return parts.join(".");
}
