import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ZAI_ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic";
export const ZAI_OPENAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
export const DEFAULT_MODEL = "glm-5.2";
export const DEFAULT_EFFORT = "medium";

export const PLUGIN_DIR = join(homedir(), ".glm-plugin");
export const JOBS_DIR = join(PLUGIN_DIR, "jobs");
export const CONFIG_PATH = join(PLUGIN_DIR, "config.json");
export const SETTINGS_PATH = join(PLUGIN_DIR, "settings.json");

export const KEY_FILE = join(homedir(), ".config", "zai", "api-key");

export function resolveApiKey() {
  if (process.env.ZAI_API_KEY) return process.env.ZAI_API_KEY.trim();
  if (process.env.ZA_API_KEY) return process.env.ZA_API_KEY.trim();
  if (existsSync(KEY_FILE)) {
    return readFileSync(KEY_FILE, "utf8").trim();
  }
  return null;
}

export function isReady() {
  return resolveApiKey() !== null;
}

export function buildZaiEnv(model = DEFAULT_MODEL) {
  const key = resolveApiKey();
  if (!key) {
    throw new Error(
      "No z.ai API key found. Set ZAI_API_KEY (or ZA_API_KEY) env var, " +
        "or create ~/.config/zai/api-key. Run: /glm:setup"
    );
  }
  return {
    ...process.env,
    ANTHROPIC_BASE_URL: ZAI_ANTHROPIC_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: key,
    ANTHROPIC_MODEL: model,
    ANTHROPIC_SMALL_FAST_MODEL: model,
    ANTHROPIC_API_KEY: "",
  };
}

export function readSettings() {
  if (!existsSync(SETTINGS_PATH)) return { reviewGate: false };
  try {
    return { reviewGate: false, ...JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) };
  } catch {
    return { reviewGate: false };
  }
}

export function writeSettings(patch) {
  const cur = readSettings();
  const next = { ...cur, ...patch };
  mkdirSync(PLUGIN_DIR, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}
