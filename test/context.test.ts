import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectContext } from "../src/context.ts";

function withDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "skill-index-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("detects an OpenSpec repo by the presence of an openspec/ directory", () => {
  withDir((dir) => {
    mkdirSync(join(dir, "openspec"));
    assert.equal(detectContext(dir), "openspec");
  });
});

test("treats a repo without openspec/ as plain", () => {
  withDir((dir) => {
    mkdirSync(join(dir, "src"));
    assert.equal(detectContext(dir), "plain");
  });
});
