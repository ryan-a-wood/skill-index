import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../src/frontmatter.ts";

test("extracts name and description and the body after the closing delimiter", () => {
  const source = [
    "---",
    "name: tdd",
    "description: Test-driven development.",
    "---",
    "",
    "# TDD",
    "",
    "body text",
    "",
  ].join("\n");

  const { data, body } = parseFrontmatter(source);

  assert.deepEqual(data, {
    name: "tdd",
    description: "Test-driven development.",
  });
  assert.equal(body, "# TDD\n\nbody text\n");
});

test("preserves scalar types from the frontmatter", () => {
  const source = [
    "---",
    "name: ask-matt",
    "disable-model-invocation: true",
    "count: 3",
    "---",
    "body",
  ].join("\n");

  const { data } = parseFrontmatter(source);

  assert.equal(data["disable-model-invocation"], true);
  assert.equal(data["count"], 3);
});

test("returns the whole source as body when there is no frontmatter", () => {
  const source = "# Just a heading\n\nno frontmatter here\n";

  const { data, body } = parseFrontmatter(source);

  assert.deepEqual(data, {});
  assert.equal(body, source);
});

test("handles CRLF line endings", () => {
  const source = "---\r\nname: x\r\n---\r\nbody\r\n";

  const { data, body } = parseFrontmatter(source);

  assert.equal(data["name"], "x");
  assert.equal(body.startsWith("body"), true);
});
