#!/usr/bin/env node
// Makes one canonical copy of each skill visible to every harness that needs
// it, via symlinks. There is no shared global skills root:
//
//   Claude Code : reads only ~/.claude/skills
//   opencode    : reads ~/.config/opencode/skills AND ~/.agents/skills
//
// So repo-owned skills are linked into both harness roots, and the CLI-managed
// skills in ~/.agents/skills (which opencode already sees) are bridged into
// Claude's root. Every link points at the canonical copy, so updates to the
// canonical copy propagate with no re-run.
//
// Idempotent. Never deletes a real file or directory it did not create: it only
// replaces symlinks.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();

const repoSkills = join(repoRoot, "skills");
const sharedSkills = join(home, ".agents", "skills");
const claudeSkills = join(home, ".claude", "skills");
const opencodeSkills = join(home, ".config", "opencode", "skills");

type Outcome = "linked" | "relinked" | "ok" | "skipped";

function ensureLink(name: string, from: string, toDir: string): Outcome {
  mkdirSync(toDir, { recursive: true });
  const linkPath = join(toDir, name);
  const existing = lstatSync(linkPath, { throwIfNoEntry: false });

  if (existing) {
    if (!existing.isSymbolicLink()) return "skipped";
    // A live link is left alone: sources are visited in priority order, so the
    // first (most canonical) copy wins instead of churning on every run.
    if (existsSync(resolve(dirname(linkPath), readlinkSync(linkPath)))) return "ok";
    rmSync(linkPath, { force: true });
  }

  symlinkSync(from, linkPath, "dir");
  return existing ? "relinked" : "linked";
}

function skillDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const tally: Record<Outcome, number> = { linked: 0, relinked: 0, ok: 0, skipped: 0 };
const problems: string[] = [];

function record(name: string, from: string, toDir: string): void {
  const outcome = ensureLink(name, from, toDir);
  tally[outcome]++;
  if (outcome === "skipped") {
    problems.push(`${join(toDir, name)} is a real file/directory, not a symlink - left alone`);
  }
}

// 1. Repo-owned skills -> both harness roots.
for (const name of skillDirs(repoSkills)) {
  const from = join(repoSkills, name);
  record(name, from, claudeSkills);
  record(name, from, opencodeSkills);
}

// 2. CLI-managed skills -> Claude's root only (opencode reads them natively).
for (const name of skillDirs(sharedSkills)) {
  record(name, join(sharedSkills, name), claudeSkills);
}

// 3. opencode-only skills (e.g. linear-planning) -> Claude's root, so both
//    harnesses offer the same catalogue. Names already linked above are kept.
for (const name of skillDirs(opencodeSkills)) {
  record(name, join(opencodeSkills, name), claudeSkills);
}

for (const outcome of ["linked", "relinked", "ok"] as const) {
  if (tally[outcome] > 0) console.log(`${outcome.padEnd(9)} ${tally[outcome]}`);
}
if (problems.length > 0) {
  console.log(`skipped  ${tally.skipped}`);
  for (const problem of problems) console.error(`  ! ${problem}`);
}
