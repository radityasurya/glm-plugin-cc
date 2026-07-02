import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_GLM = join(__dirname, "..", "plugins", "glm");
const COMMANDS_DIR = join(PLUGINS_GLM, "commands");
const AGENTS_DIR = join(PLUGINS_GLM, "agents");

function hasFrontmatter(text) {
  return text.startsWith("---\n") && text.indexOf("\n---\n", 4) > 0;
}

describe("glm command files", () => {
  const files = existsSync(COMMANDS_DIR)
    ? readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  it("command files exist", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${f} has YAML frontmatter`, () => {
      const text = readFileSync(join(COMMANDS_DIR, f), "utf8");
      expect(hasFrontmatter(text)).toBe(true);
    });

    it(`${f} references the broker script`, () => {
      const text = readFileSync(join(COMMANDS_DIR, f), "utf8");
      expect(text).toContain("${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs");
    });
  }
});

describe("glm agent files", () => {
  it("agents/glm-rescue.md exists with frontmatter", () => {
    const p = join(AGENTS_DIR, "glm-rescue.md");
    expect(existsSync(p)).toBe(true);
    const text = readFileSync(p, "utf8");
    expect(hasFrontmatter(text)).toBe(true);
  });
});
