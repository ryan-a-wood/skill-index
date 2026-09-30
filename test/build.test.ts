import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/build.ts";
import { withRoot, writeSkill } from "./support.ts";

const taxonomy = [
  "intro: Read this before choosing a skill.",
  "start:",
  '  - when: "the working directory contains an `openspec/` directory"',
  "    use: OpenSpec flow",
  '  - when: "otherwise"',
  "    use: Plain flow",
  "flows:",
  "  - id: openspec",
  "    title: OpenSpec flow - idea to archived change",
  "    steps:",
  '      - "`opsx:explore` - optional, when the idea is still fuzzy"',
  '      - "`opsx:apply` - drive `/tdd` per task"',
  "capabilities:",
  "  - title: Sharpen a fuzzy idea",
  '    openspec: "`opsx:explore`"',
  '    plain: "`grill-with-docs`"',
  "",
].join("\n");

test("renders the start rules, flows, capability map, and every indexed skill", () => {
  withRoot((root) => {
    writeSkill(root, "tdd", "name: tdd\ndescription: Test-driven development.\n");
    writeSkill(root, "linear-planning", "name: linear-planning\ndescription: Plan in Linear.\n");

    const { index, markdown } = buildIndex({
      roots: [root],
      lockfile: { skills: { tdd: { source: "mattpocock/skills" } } },
      taxonomy,
    });

    assert.deepEqual(
      index.map((s) => s.name),
      ["linear-planning", "tdd"],
    );
    assert.match(markdown, /## Start here/);
    assert.match(markdown, /OpenSpec flow/);
    assert.match(markdown, /## OpenSpec flow - idea to archived change/);
    assert.match(markdown, /`opsx:apply` - drive `\/tdd` per task/);
    assert.match(markdown, /## Capability map/);
    assert.match(markdown, /\| Sharpen a fuzzy idea \| `opsx:explore` \| `grill-with-docs` \|/);
    assert.match(markdown, /All indexed skills \(2\)/);
    assert.match(markdown, /- \*\*tdd\*\*[^\n]*mattpocock\/skills/);
    assert.match(markdown, /- \*\*linear-planning\*\*/);
  });
});

test("tolerates an empty or malformed taxonomy", () => {
  withRoot((root) => {
    writeSkill(root, "tdd", "name: tdd\ndescription: x\n");

    const empty = buildIndex({ roots: [root], lockfile: {}, taxonomy: "" });
    const garbage = buildIndex({ roots: [root], lockfile: {}, taxonomy: "nope: true\n" });

    for (const result of [empty, garbage]) {
      assert.match(result.markdown, /# Skill Router/);
      assert.match(result.markdown, /All indexed skills \(1\)/);
      assert.equal(result.markdown.includes("## Start here"), false);
    }
  });
});
