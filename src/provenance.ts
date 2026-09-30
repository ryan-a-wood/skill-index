import type { DiscoveredSkill } from "./discover.ts";

export interface SkillProvenance {
  source: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  skillPath: string | null;
  skillFolderHash: string | null;
  pluginName: string | null;
  installedAt: string | null;
  updatedAt: string | null;
}

export type IndexedSkill = DiscoveredSkill & { provenance: SkillProvenance | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProvenance(raw: Record<string, unknown>): SkillProvenance {
  const str = (key: string): string | null =>
    typeof raw[key] === "string" ? (raw[key] as string) : null;

  return {
    source: str("source"),
    sourceType: str("sourceType"),
    sourceUrl: str("sourceUrl"),
    skillPath: str("skillPath"),
    skillFolderHash: str("skillFolderHash"),
    pluginName: str("pluginName"),
    installedAt: str("installedAt"),
    updatedAt: str("updatedAt"),
  };
}

export function mergeProvenance(
  skills: DiscoveredSkill[],
  lockfile: unknown,
): IndexedSkill[] {
  const entries =
    isRecord(lockfile) && isRecord(lockfile["skills"]) ? lockfile["skills"] : {};

  return skills.map((skill) => {
    const raw = entries[skill.name];
    return {
      ...skill,
      provenance: isRecord(raw) ? toProvenance(raw) : null,
    };
  });
}
