import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseFrontmatter } from "./frontmatter.ts";

export interface DiscoveredSkill {
  name: string;
  description: string;
  skillPath: string;
  root: string;
}

function findSkillFiles(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      findSkillFiles(path, out);
      continue;
    }
    if (entry.isFile() && entry.name === "SKILL.md") {
      out.push(path);
      continue;
    }
    if (entry.isSymbolicLink()) {
      // Harness skill dirs are often symlinks to a canonical copy, and a
      // symlinked SKILL.md resolves to a file. Either way, follow it.
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        findSkillFiles(path, out);
      } else if (stats.isFile() && entry.name === "SKILL.md") {
        out.push(path);
      }
    }
  }
}

export function discoverSkills(roots: string[]): DiscoveredSkill[] {
  const byName = new Map<string, DiscoveredSkill>();

  for (const root of roots) {
    const files: string[] = [];
    findSkillFiles(root, files);
    files.sort();

    for (const skillPath of files) {
      const { data } = parseFrontmatter(readFileSync(skillPath, "utf8"));
      const name =
        typeof data["name"] === "string" && data["name"].trim() !== ""
          ? data["name"]
          : basename(dirname(skillPath));

      if (byName.has(name)) {
        continue;
      }

      byName.set(name, {
        name,
        description: typeof data["description"] === "string" ? data["description"] : "",
        skillPath,
        root,
      });
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
