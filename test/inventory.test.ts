import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collect, diff, driftLine, stripJsonc } from "../bin/inventory.ts";

function fakeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "inventory-"));
  const write = (path: string, body: unknown) => {
    const full = join(home, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, typeof body === "string" ? body : JSON.stringify(body));
  };

  // A CLI-managed skill, bridged into Claude's root.
  write(".agents/skills/wrangler/SKILL.md", "---\nname: wrangler\n---\n");
  write(".agents/.skill-lock.json", { skills: { wrangler: { source: "cloudflare/skills" } } });
  mkdirSync(join(home, ".claude/skills"), { recursive: true });
  symlinkSync(join(home, ".agents/skills/wrangler"), join(home, ".claude/skills/wrangler"));
  // A skill only opencode has.
  write(".config/opencode/skills/only-oc/SKILL.md", "x");

  // A plugin whose skills opencode reaches through symlinks: they belong to the plugin.
  const pluginPath = join(home, ".claude/plugins/cache/official/superpowers/6.4.1");
  write(".claude/plugins/cache/official/superpowers/6.4.1/skills/brainstorming/SKILL.md", "x");
  symlinkSync(join(pluginPath, "skills/brainstorming"), join(home, ".config/opencode/skills/brainstorming"));
  // An installed plugin that is a hooks module is a mod.
  const bandPath = join(home, ".claude/plugins/cache/claude-kit/session-band/0.2.0");
  write(".claude/plugins/cache/claude-kit/session-band/0.2.0/hooks/hooks.json", { modules: ["./register.tsx"] });
  write(".claude/plugins/installed_plugins.json", {
    plugins: {
      "superpowers@claude-plugins-official": [{ installPath: pluginPath, version: "6.4.1" }],
      "session-band@claude-kit": [{ installPath: bandPath, version: "0.2.0" }],
    },
  });
  write(".config/opencode/plugins/herdr.js", "");
  write(".claude/dev-mods/session-1/savvy-progress/.claude-plugin/plugin.json", {
    name: "savvy-progress",
    repository: "https://github.com/johnnyvizz/claude-kit",
  });

  write(".claude.json", {
    mcpServers: { "chrome-devtools": {} },
    projects: { "/x": { mcpServers: { "proj-only": {} } } },
  });
  write(
    ".config/opencode/opencode.jsonc",
    `{
  // comment with a "quote"
  "mcp": {
    "chrome-devtools": { "url": "https://a//b" },
    /* block */ "linear": { "enabled": true },
    "off": { "enabled": false },
  },
}`,
  );
  return home;
}

test("collects skills, plugins, mods and MCP servers with harnesses", () => {
  const entries = collect(fakeHome(), "/nonexistent-repo");
  const byId = Object.fromEntries(entries.map((e) => [`${e.kind}:${e.name}`, e]));

  assert.deepEqual(byId["Skill:wrangler"].harnesses, ["Claude Code", "opencode"]);
  assert.equal(byId["Skill:wrangler"].path, "~/.agents/skills/wrangler");
  assert.equal(byId["Skill:wrangler"].source, "cloudflare/skills");
  assert.deepEqual(byId["Skill:only-oc"].harnesses, ["opencode"]);

  assert.equal(byId["Plugin:superpowers"].source, "claude-plugins-official");
  assert.deepEqual(byId["Plugin:superpowers"].harnesses, ["Claude Code", "opencode"]);
  assert.equal(byId["Skill:brainstorming"], undefined, "plugin skills are not listed separately");
  assert.deepEqual(byId["Plugin:herdr"].harnesses, ["opencode"]);

  assert.equal(byId["Plugin:session-band"], undefined);
  assert.equal(byId["Mod:session-band"].source, "claude-kit");
  assert.deepEqual(byId["Mod:session-band"].harnesses, ["Claude Code"]);
  assert.equal(byId["Mod:savvy-progress"].path, "~/.claude/dev-mods/session-1/savvy-progress");

  assert.deepEqual(byId["MCP server:chrome-devtools"].harnesses, ["Claude Code", "opencode"]);
  assert.deepEqual(byId["MCP server:linear"].harnesses, ["opencode"]);
  assert.deepEqual(byId["MCP server:proj-only"].harnesses, ["Claude Code"]);
  assert.equal(byId["MCP server:off"], undefined, "disabled servers are skipped");

  assert.deepEqual(
    entries.map((e) => `${e.kind}:${e.name}`),
    [
      "Skill:only-oc",
      "Skill:wrangler",
      "Plugin:herdr",
      "Plugin:superpowers",
      "Mod:savvy-progress",
      "Mod:session-band",
      "MCP server:chrome-devtools",
      "MCP server:linear",
      "MCP server:proj-only",
    ],
    "grouped by kind, then by name, so snapshots diff cleanly",
  );
});

test("stripJsonc keeps // inside strings and drops trailing commas", () => {
  assert.deepEqual(JSON.parse(stripJsonc('{"u": "a//b", // c\n "l": [1,],}')), { u: "a//b", l: [1] });
});

test("diff and driftLine report added and removed by kind", () => {
  const a = { kind: "Skill", name: "a", harnesses: [], path: "", source: "" } as const;
  const b = { kind: "Plugin", name: "b", harnesses: [], path: "", source: "" } as const;
  const c = { kind: "Skill", name: "c", harnesses: [], path: "", source: "" } as const;

  const d = diff([a, b], [a, c]);
  assert.deepEqual(d.added.map((e) => e.name), ["c"]);
  assert.deepEqual(d.removed.map((e) => e.name), ["b"]);
  assert.equal(driftLine(d), "Toolkit drift: +1 skill (c), -1 plugin (b). Notion not reconciled yet.");
  assert.equal(driftLine(diff([a], [a])), undefined);

  const many = "abcdefg".split("").map((name) => ({ ...a, name }));
  assert.equal(driftLine(diff([], many)), "Toolkit drift: +7 skills (a, b, c, d, e, +2 more). Notion not reconciled yet.");
});
