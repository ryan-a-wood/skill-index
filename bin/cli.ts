#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex } from "../src/build.ts";
import { defaultLockfilePath, defaultRoots, projectRoots } from "../src/config.ts";
import { detectContext } from "../src/context.ts";
import { discoverSkills } from "../src/discover.ts";
import { mergeProvenance } from "../src/provenance.ts";

const cwd = process.cwd();

function allRoots(): string[] {
  return [...defaultRoots(), ...projectRoots(cwd)];
}

function readJson(path: string): unknown {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function readText(path: string, fallback: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}

function loadIndex() {
  return mergeProvenance(discoverSkills(allRoots()), readJson(defaultLockfilePath()));
}

const [command, ...args] = process.argv.slice(2);

if (command === "build") {
  const result = buildIndex({
    roots: allRoots(),
    lockfile: readJson(defaultLockfilePath()),
    taxonomy: readText(join(cwd, "taxonomy.yml"), ""),
  });
  mkdirSync("dist", { recursive: true });
  writeFileSync(join("dist", "index.json"), `${JSON.stringify(result.index, null, 2)}\n`);
  writeFileSync(join("dist", "ROUTER.md"), result.markdown);
  console.log(`Indexed ${result.index.length} skills -> dist/index.json, dist/ROUTER.md`);
} else if (command === "context") {
  console.log(detectContext(cwd));
} else if (command === "ls") {
  const index = loadIndex();
  for (const skill of index) {
    const source = skill.provenance?.source ?? "local";
    console.log(`${skill.name}\t${source}\t${skill.description}`);
  }
  console.error(`\n${index.length} skills`);
} else if (command === "which") {
  const query = args.join(" ").toLowerCase();
  const hits = loadIndex().filter(
    (skill) =>
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query),
  );
  for (const skill of hits) {
    console.log(`${skill.name}\t${skill.description}`);
  }
  console.error(`\n${hits.length} matches for "${query}"`);
} else {
  console.log("Usage: skill-index <build|context|ls|which <query>>");
  process.exitCode = 1;
}
