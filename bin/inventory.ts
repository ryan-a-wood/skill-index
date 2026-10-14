#!/usr/bin/env node
// Lists what is actually installed (skills, plugins, mods, MCP servers) by
// reading disk, so the Notion "Toolkit Inventory" can be reconciled against it
// instead of being kept up to date by memory.
//
//   node bin/inventory.ts               write the current snapshot, print it as JSON
//   node bin/inventory.ts --check       compare with the last reconciled snapshot;
//                                       prints a Claude Code hook message on drift
//   node bin/inventory.ts --mark-synced record the current snapshot as reconciled
//
// Snapshots live next to the skills CLI lock file in ~/.agents, so every
// harness's tooling can find them.
import { copyFileSync, existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Kind = "Skill" | "Plugin" | "Mod" | "MCP server";
export type Harness = "Claude Code" | "opencode";

export interface Entry {
  kind: Kind;
  name: string;
  harnesses: readonly Harness[];
  path: string;
  source: string;
}

const KIND_ORDER: Kind[] = ["Skill", "Plugin", "Mod", "MCP server"];

function readJson(path: string): any {
  try {
    return JSON.parse(stripJsonc(readFileSync(path, "utf8")));
  } catch {
    return undefined;
  }
}

function children(dir: string, keep: (path: string) => boolean = isDir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => !name.startsWith(".") && keep(join(dir, name)));
}

function isDir(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

// Removes // and /* */ comments outside strings, then trailing commas.
export function stripJsonc(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += text[++i] ?? "";
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i === -1) break;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function collect(home = homedir(), repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")): Entry[] {
  const homes = [home, realpathSync(home)];
  const tilde = (path: string) => {
    const root = homes.find((h) => path.startsWith(h + "/"));
    return root ? "~" + path.slice(root.length) : path;
  };
  const entries = new Map<string, Entry>();
  const add = (entry: Entry) => {
    const id = `${entry.kind}:${entry.name}`;
    const prev = entries.get(id);
    const harnesses = new Set([...(prev?.harnesses ?? []), ...entry.harnesses]);
    entries.set(id, {
      ...(prev ?? entry),
      harnesses: (["Claude Code", "opencode"] as const).filter((h) => harnesses.has(h)),
    });
  };

  // Claude Code plugins.
  const installed = readJson(join(home, ".claude", "plugins", "installed_plugins.json"))?.plugins ?? {};
  const pluginRoots: Array<[root: string, name: string]> = [];
  for (const [id, installs] of Object.entries<any[]>(installed)) {
    const [name, marketplace = ""] = id.split("@");
    const installPath: string = installs[0]?.installPath ?? "";
    if (existsSync(installPath)) pluginRoots.push([realpathSync(installPath) + "/", name]);
    // A plugin whose hooks are a module is a mod, however it was installed.
    const kind = readJson(join(installPath, "hooks", "hooks.json"))?.modules ? "Mod" : "Plugin";
    add({ kind, name, harnesses: ["Claude Code"], path: tilde(installPath), source: marketplace });
  }

  // Skills. Same priority as sync-skills: repo, then ~/.agents, then the harness roots.
  const claudeSkills = join(home, ".claude", "skills");
  const agentSkills = join(home, ".agents", "skills");
  const opencodeSkills = join(home, ".config", "opencode", "skills");
  const roots = [join(repoRoot, "skills"), agentSkills, opencodeSkills, claudeSkills];
  const lock = readJson(join(home, ".agents", ".skill-lock.json"))?.skills ?? {};
  const names = new Set(roots.flatMap((root) => children(root)));
  for (const name of names) {
    const home_ = roots.find((root) => isDir(join(root, name)))!;
    const real = realpathSync(join(home_, name));
    const harnesses: Harness[] = [];
    if (isDir(join(claudeSkills, name))) harnesses.push("Claude Code");
    if (isDir(join(agentSkills, name)) || isDir(join(opencodeSkills, name))) harnesses.push("opencode");
    // A skill linked out of a plugin is part of that plugin, not an install of its own.
    const plugin = pluginRoots.find(([root]) => real.startsWith(root));
    if (plugin) {
      add({ kind: "Plugin", name: plugin[1], harnesses, path: "", source: "" });
      continue;
    }
    add({
      kind: "Skill",
      name,
      harnesses,
      path: tilde(real),
      source: lock[name]?.source ?? (home_ === roots[0] ? "skill-index repo" : "local"),
    });
  }

  // opencode plugins: one file each.
  const opencodePlugins = join(home, ".config", "opencode", "plugins");
  for (const file of children(opencodePlugins, (p) => /\.[cm]?[jt]s$/.test(p))) {
    add({ kind: "Plugin", name: basename(file, extname(file)), harnesses: ["opencode"], path: tilde(join(opencodePlugins, file)), source: "local" });
  }

  // Claude Code mods under dev-mods/<session>/<mod>.
  const devMods = join(home, ".claude", "dev-mods");
  for (const session of children(devMods)) {
    for (const mod of children(join(devMods, session))) {
      const dir = join(devMods, session, mod);
      const manifest = readJson(join(dir, ".claude-plugin", "plugin.json"));
      if (!manifest) continue;
      add({ kind: "Mod", name: manifest.name ?? mod, harnesses: ["Claude Code"], path: tilde(dir), source: manifest.repository ?? "local" });
    }
  }

  // MCP servers: Claude Code (user and per-project) and opencode.
  const claudeJson = readJson(join(home, ".claude.json")) ?? {};
  const claudeServers = [claudeJson.mcpServers ?? {}, ...Object.values<any>(claudeJson.projects ?? {}).map((p) => p.mcpServers ?? {})];
  for (const servers of claudeServers) {
    for (const name of Object.keys(servers)) {
      add({ kind: "MCP server", name, harnesses: ["Claude Code"], path: "~/.claude.json", source: "" });
    }
  }
  const opencodeConfig = join(home, ".config", "opencode", "opencode.jsonc");
  const opencodeMcp = (readJson(opencodeConfig) ?? readJson(opencodeConfig.replace(/c$/, "")))?.mcp ?? {};
  for (const [name, config] of Object.entries<any>(opencodeMcp)) {
    if (config?.enabled === false) continue;
    add({ kind: "MCP server", name, harnesses: ["opencode"], path: "~/.config/opencode/opencode.jsonc", source: config?.url ?? "" });
  }

  return [...entries.values()].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
  );
}

export interface Diff {
  added: Entry[];
  removed: Entry[];
}

export function diff(before: readonly Entry[], after: readonly Entry[]): Diff {
  const id = (e: Entry) => `${e.kind}:${e.name}`;
  const beforeIds = new Set(before.map(id));
  const afterIds = new Set(after.map(id));
  return {
    added: after.filter((e) => !beforeIds.has(id(e))),
    removed: before.filter((e) => !afterIds.has(id(e))),
  };
}

export function driftLine({ added, removed }: Diff): string | undefined {
  if (added.length + removed.length === 0) return undefined;
  const part = (sign: string, list: Entry[]) =>
    KIND_ORDER.flatMap((kind) => {
      const names = list.filter((e) => e.kind === kind).map((e) => e.name);
      if (names.length === 0) return [];
      const label = kind.toLowerCase() + (names.length === 1 ? "" : "s");
      const shown = names.length > 6 ? [...names.slice(0, 5), `+${names.length - 5} more`] : names;
      return [`${sign}${names.length} ${label} (${shown.join(", ")})`];
    });
  return `Toolkit drift: ${[...part("+", added), ...part("-", removed)].join(", ")}. Notion not reconciled yet.`;
}

function main(): void {
  const home = homedir();
  const current = join(home, ".agents", ".toolkit-inventory.json");
  const synced = join(home, ".agents", ".toolkit-inventory.synced.json");
  const entries = collect(home);
  const mode = process.argv[2];

  if (mode === "--check") {
    const line = driftLine(diff(readJson(synced) ?? [], entries));
    // Claude Code shows systemMessage to the user; silence means no drift.
    if (line) console.log(JSON.stringify({ systemMessage: `${line} Run the "Reconcile toolkit inventory" task.` }));
    return;
  }

  writeFileSync(current, JSON.stringify(entries, null, 2) + "\n");
  if (mode === "--mark-synced") {
    copyFileSync(current, synced);
    console.log(`marked ${entries.length} entries as reconciled`);
    return;
  }
  console.log(JSON.stringify(entries, null, 2));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
