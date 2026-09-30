import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills } from "../src/discover.ts";

function writeSkill(root: string, dir: string, frontmatter: string): string {
  const skillDir = join(root, dir);
  mkdirSync(skillDir, { recursive: true });
  const path = join(skillDir, "SKILL.md");
  writeFileSync(path, `---\n${frontmatter}---\nbody\n`);
  return path;
}

function withRoot(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "skill-index-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("discovers every SKILL.md under a root, including nested ones", () => {
  withRoot((root) => {
    writeSkill(root, "tdd", "name: tdd\ndescription: Test-driven development.\n");
    writeSkill(root, "grill-me", "name: grill-me\ndescription: Interview me.\n");
    writeSkill(root, "buckets/engineering/tdd-deep", "name: tdd-deep\ndescription: Deep TDD.\n");
    mkdirSync(join(root, "not-a-skill"));
    writeFileSync(join(root, "README.md"), "# root\n");

    const skills = discoverSkills([root]);

    assert.deepEqual(
      skills.map((s) => s.name),
      ["grill-me", "tdd", "tdd-deep"],
    );
    const tdd = skills.find((s) => s.name === "tdd")!;
    assert.equal(tdd.description, "Test-driven development.");
    assert.equal(tdd.skillPath, join(root, "tdd", "SKILL.md"));
    assert.equal(tdd.root, root);
  });
});

test("falls back to the directory name when frontmatter has no name", () => {
  withRoot((root) => {
    writeSkill(root, "some-skill", "description: No name here.\n");

    const skills = discoverSkills([root]);

    assert.equal(skills.length, 1);
    assert.equal(skills[0]!.name, "some-skill");
    assert.equal(skills[0]!.description, "No name here.");
  });
});

test("de-duplicates skills found in multiple roots, first root wins", () => {
  withRoot((first) => {
    withRoot((second) => {
      writeSkill(first, "tdd", "name: tdd\ndescription: from first\n");
      writeSkill(second, "tdd", "name: tdd\ndescription: from second\n");

      const skills = discoverSkills([first, second]);

      assert.equal(skills.length, 1);
      assert.equal(skills[0]!.description, "from first");
      assert.equal(skills[0]!.root, first);
    });
  });
});

test("tolerates a missing root", () => {
  withRoot((root) => {
    writeSkill(root, "tdd", "name: tdd\ndescription: x\n");

    const skills = discoverSkills([join(root, "does-not-exist"), root]);

    assert.deepEqual(
      skills.map((s) => s.name),
      ["tdd"],
    );
  });
});

test("follows a symlinked skill directory", () => {
  withRoot((canonical) => {
    withRoot((mirror) => {
      writeSkill(canonical, "next-skill", "name: next-skill\ndescription: Router.\n");
      symlinkSync(join(canonical, "next-skill"), join(mirror, "next-skill"), "dir");

      const skills = discoverSkills([mirror]);

      assert.deepEqual(
        skills.map((s) => s.name),
        ["next-skill"],
      );
      assert.equal(skills[0]!.description, "Router.");
    });
  });
});

test("follows a symlinked SKILL.md file", () => {
  withRoot((canonical) => {
    withRoot((mirror) => {
      const path = writeSkill(canonical, "next-skill", "name: next-skill\ndescription: Router.\n");
      mkdirSync(join(mirror, "next-skill"));
      symlinkSync(path, join(mirror, "next-skill", "SKILL.md"));

      const skills = discoverSkills([mirror]);

      assert.deepEqual(
        skills.map((s) => s.name),
        ["next-skill"],
      );
    });
  });
});
