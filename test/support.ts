import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function withRoot(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "skill-index-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function writeSkill(root: string, dir: string, frontmatter: string): string {
  const skillDir = join(root, dir);
  mkdirSync(skillDir, { recursive: true });
  const path = join(skillDir, "SKILL.md");
  writeFileSync(path, `---\n${frontmatter}---\nbody\n`);
  return path;
}
