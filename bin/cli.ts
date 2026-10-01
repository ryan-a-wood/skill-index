#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex, parseTaxonomy, triggerTexts } from "../src/build.ts";
import { defaultLockfilePath, defaultRoots, projectRoots } from "../src/config.ts";
import { detectContext } from "../src/context.ts";
import { discoverSkills } from "../src/discover.ts";
import { keywordPredict, knownCandidates, scoreEval, type EvalCase } from "../src/eval.ts";
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
  if (result.unplaced.length > 0) {
    console.error(`\n${result.unplaced.length} skills not placed in taxonomy.yml:`);
    for (const name of result.unplaced) console.error(`  - ${name}`);
  }
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
} else if (command === "eval") {
  const casesPath = join(cwd, "eval", "cases.json");
  if (!existsSync(casesPath)) {
    console.error(`No eval cases at ${casesPath}`);
    process.exit(1);
  }
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as EvalCase[];
  const taxonomy = parseTaxonomy(readText(join(cwd, "taxonomy.yml"), ""));
  const installed = new Set(loadIndex().map((skill) => skill.name));
  const skills = knownCandidates(triggerTexts(taxonomy), installed);

  const predictionsFile = args.find((a) => a.startsWith("--predictions="));
  const predictions: Record<string, string[]> = predictionsFile
    ? (JSON.parse(readFileSync(predictionsFile.split("=")[1]!, "utf8")) as Record<string, string[]>)
    : Object.fromEntries(
        cases.map((c) => [c.id, keywordPredict(c.utterance, skills)] as const),
      );

  const label = predictionsFile ? `recorded: ${predictionsFile.split("=")[1]}` : "keyword baseline";
  const report = scoreEval(cases, predictions);

  console.log(`eval: ${label}`);
  console.log(`  cases     ${report.total}`);
  console.log(`  top-1     ${report.top1} (${(report.accuracy * 100).toFixed(1)}%)`);
  console.log(`  top-3     ${report.top3}`);
  for (const entry of report.byContext) {
    console.log(`  ${entry.context.padEnd(9)} ${entry.top1}/${entry.total}`);
  }
  if (report.misses.length > 0) {
    console.log(`\n  misses (${report.misses.length}):`);
    for (const miss of report.misses) {
      const got = miss.predicted.length > 0 ? miss.predicted.join(", ") : "(nothing)";
      console.log(`    ${miss.id}: "${miss.utterance}"`);
      console.log(`      want ${miss.gold} | got ${got}`);
    }
  }
  if (report.missing.length > 0) {
    console.log(`\n  no prediction: ${report.missing.join(", ")}`);
  }
} else {
  console.log("Usage: skill-index <build|context|ls|which <query>>");
  process.exitCode = 1;
}
