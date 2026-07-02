import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ZAI_ANTHROPIC_BASE_URL,
  ZAI_OPENAI_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_EFFORT,
  resolveApiKey,
  isReady,
  buildZaiEnv,
  readSettings,
  writeSettings,
} from "../plugins/glm/scripts/config.mjs";

let counter = 0;

export function makeTempPluginDir() {
  const base = mkdtempSync(join(tmpdir(), "glm-plugin-test-"));
  counter += 1;
  return join(base, `plug-${process.pid}-${counter}`);
}

export function clearDir(p) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
  }
}

export function mockConfig(dir) {
  return {
    PLUGIN_DIR: dir,
    JOBS_DIR: join(dir, "jobs"),
    CONFIG_PATH: join(dir, "config.json"),
    SETTINGS_PATH: join(dir, "settings.json"),
    KEY_FILE: join(dir, "api-key"),
    ZAI_ANTHROPIC_BASE_URL,
    ZAI_OPENAI_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_EFFORT,
    resolveApiKey,
    isReady,
    buildZaiEnv,
    readSettings,
    writeSettings,
  };
}
