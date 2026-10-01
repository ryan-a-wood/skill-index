export type RepoContextName = "openspec" | "plain";

export interface EvalCase {
  id: string;
  context: RepoContextName;
  utterance: string;
  gold: string;
}

export interface Prediction {
  id: string;
  gold: string;
  utterance: string;
  predicted: string[];
}

export interface EvalReport {
  total: number;
  scored: number;
  top1: number;
  top3: number;
  accuracy: number;
  missing: string[];
  misses: Prediction[];
  byContext: { context: RepoContextName; total: number; top1: number }[];
}

const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "it", "to", "of", "and", "in", "on", "for",
  "my", "me", "i", "we", "our", "that", "this", "with", "be", "do", "does", "not",
  "so", "but", "at", "by", "from", "up", "out", "just", "can", "need", "want",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function scoreEval(cases: EvalCase[], predictions: Record<string, string[]>): EvalReport {
  const top1 = cases.filter((c) => predictions[c.id]?.[0] === c.gold).length;
  const top3 = cases.filter((c) => predictions[c.id]?.slice(0, 3).includes(c.gold)).length;
  const missing = cases.filter((c) => !predictions[c.id]).map((c) => c.id);
  const misses = cases
    .filter((c) => predictions[c.id] && predictions[c.id]![0] !== c.gold)
    .map((c) => ({
      id: c.id,
      gold: c.gold,
      utterance: c.utterance,
      predicted: predictions[c.id]!,
    }));

  const contexts: RepoContextName[] = ["openspec", "plain"];
  const byContext = contexts
    .map((context) => {
      const subset = cases.filter((c) => c.context === context);
      const hits = subset.filter((c) => predictions[c.id]?.[0] === c.gold).length;
      return { context, total: subset.length, top1: hits };
    })
    .filter((entry) => entry.total > 0);

  return {
    total: cases.length,
    scored: cases.length - missing.length,
    top1,
    top3,
    accuracy: cases.length > 0 ? top1 / cases.length : 0,
    missing,
    misses,
    byContext,
  };
}

/**
 * A deliberately dumb, dependency-free ranker: token overlap between the
 * utterance and each skill's hand-authored trigger text. It exists to give the
 * tree-walking router something to beat, and to prove the eval harness works.
 */
/**
 * Keep only triggers whose name is an actually-installed skill. Flow steps
 * legitimately reference commands that are not skills (`/clear`, `/compact`),
 * and a ranker must never propose those as if they were skills.
 */
export function knownCandidates(
  triggers: { name: string; text: string }[],
  known: Set<string>,
): { name: string; text: string }[] {
  return triggers.filter((trigger) => known.has(trigger.name));
}

export function keywordPredict(
  utterance: string,
  skills: { name: string; text: string }[],
  limit = 3,
): string[] {
  const utteranceTokens = new Set(tokens(utterance));
  if (utteranceTokens.size === 0) return [];

  const scored = skills
    .map((skill) => {
      const skillTokens = new Set(tokens(skill.text));
      let overlap = 0;
      for (const token of utteranceTokens) {
        if (skillTokens.has(token)) overlap++;
      }
      return { name: skill.name, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.name.localeCompare(b.name));

  return scored.slice(0, limit).map((entry) => entry.name);
}