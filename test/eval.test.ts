import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreEval, keywordPredict, knownCandidates, type EvalCase } from "../src/eval.ts";

const cases: EvalCase[] = [
  { id: "a", context: "plain", utterance: "the ci test flakes", gold: "diagnosing-bugs" },
  { id: "b", context: "plain", utterance: "review my branch", gold: "code-review" },
  { id: "c", context: "plain", utterance: "slow page loads", gold: "web-perf" },
];

test("scores exact matches as top-1 hits", () => {
  const report = scoreEval(cases, {
    a: ["diagnosing-bugs"],
    b: ["code-review", "retro"],
    c: ["web-perf"],
  });

  assert.equal(report.total, 3);
  assert.equal(report.scored, 3);
  assert.equal(report.top1, 3);
  assert.equal(report.top3, 3);
  assert.equal(report.accuracy, 1);
});

test("a gold skill in second place counts for top-3 but not top-1", () => {
  const report = scoreEval(cases, {
    a: ["triage", "diagnosing-bugs"],
    b: ["code-review"],
    c: ["web-perf"],
  });

  assert.equal(report.top1, 2);
  assert.equal(report.top3, 3);
  assert.equal(report.misses.length, 1);
  assert.equal(report.misses[0]!.id, "a");
  assert.equal(report.misses[0]!.gold, "diagnosing-bugs");
  assert.deepEqual(report.misses[0]!.predicted, ["triage", "diagnosing-bugs"]);
});

test("reports cases with no prediction separately from wrong predictions", () => {
  const report = scoreEval(cases, { a: ["diagnosing-bugs"], b: ["code-review"] });

  assert.deepEqual(report.missing, ["c"]);
  assert.equal(report.scored, 2);
  assert.equal(report.top1, 2);
});

test("breaks accuracy down by repo context", () => {
  const report = scoreEval(
    [
      { id: "p", context: "plain", utterance: "x", gold: "tdd" },
      { id: "o", context: "openspec", utterance: "y", gold: "openspec-propose" },
    ],
    { p: ["tdd"], o: ["tdd"] },
  );

  assert.deepEqual(report.byContext, [
    { context: "openspec", total: 1, top1: 0 },
    { context: "plain", total: 1, top1: 1 },
  ]);
});

test("keyword ranking prefers the skill whose trigger text matches", () => {
  const skills = [
    { name: "diagnosing-bugs", text: "something is broken and resists a first glance" },
    { name: "web-perf", text: "audit page performance Core Web Vitals layout shifts" },
    { name: "triage", text: "bugs and requests you did not create are piling up" },
  ];

  const ranked = keywordPredict("page is slow, Core Web Vitals are bad", skills, 3);

  assert.equal(ranked[0], "web-perf");
});

test("keyword ranking returns nothing when nothing overlaps", () => {
  const skills = [{ name: "tdd", text: "build a behaviour test-first" }];

  assert.deepEqual(keywordPredict("zzz qqq", skills, 3), []);
});

test("knownCandidates drops referenced commands that are not installed skills", () => {
  const triggers = [
    { name: "clear", text: "/clear empty the context window" },
    { name: "tdd", text: "build a behaviour test-first" },
  ];

  const result = knownCandidates(triggers, new Set(["tdd"]));

  assert.deepEqual(
    result.map((t) => t.name),
    ["tdd"],
  );
});