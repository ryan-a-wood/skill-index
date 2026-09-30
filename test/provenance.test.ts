import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeProvenance } from "../src/provenance.ts";
import type { DiscoveredSkill } from "../src/discover.ts";

const skill = (name: string): DiscoveredSkill => ({
  name,
  description: `${name} description`,
  skillPath: `/roots/${name}/SKILL.md`,
  root: "/roots",
});

const lockfile = {
  version: 3,
  skills: {
    tdd: {
      source: "mattpocock/skills",
      sourceType: "github",
      sourceUrl: "https://github.com/mattpocock/skills.git",
      skillPath: "skills/engineering/tdd/SKILL.md",
      skillFolderHash: "bf1bf5",
      pluginName: "mattpocock-skills",
      installedAt: "2026-03-01T22:48:03.651Z",
      updatedAt: "2026-09-30T04:56:02.273Z",
    },
    "find-skills": {
      source: "vercel-labs/skills",
      sourceType: "github",
      sourceUrl: "https://github.com/vercel-labs/skills.git",
      skillPath: "skills/find-skills/SKILL.md",
      skillFolderHash: "76a98a",
      installedAt: "2026-03-01T22:16:04.740Z",
      updatedAt: "2026-09-30T04:59:43.244Z",
    },
  },
};

test("attaches lockfile provenance to a matching skill", () => {
  const [indexed] = mergeProvenance([skill("tdd")], lockfile);

  assert.equal(indexed!.provenance?.source, "mattpocock/skills");
  assert.equal(indexed!.provenance?.pluginName, "mattpocock-skills");
  assert.equal(indexed!.provenance?.skillPath, "skills/engineering/tdd/SKILL.md");
  assert.equal(indexed!.provenance?.skillFolderHash, "bf1bf5");
  assert.equal(indexed!.provenance?.updatedAt, "2026-09-30T04:56:02.273Z");
});

test("leaves provenance null when the lockfile does not mention the skill", () => {
  const [indexed] = mergeProvenance([skill("linear-planning")], lockfile);

  assert.equal(indexed!.provenance, null);
  assert.equal(indexed!.name, "linear-planning");
});

test("defaults optional provenance fields to null", () => {
  const [indexed] = mergeProvenance([skill("find-skills")], lockfile);

  assert.equal(indexed!.provenance?.pluginName, null);
});

test("tolerates a malformed lockfile", () => {
  const indexed = mergeProvenance([skill("tdd")], { nope: true });

  assert.equal(indexed[0]!.provenance, null);
});
