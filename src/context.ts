import { existsSync } from "node:fs";
import { join } from "node:path";

export type RepoContext = "openspec" | "plain";

export function detectContext(cwd: string): RepoContext {
  return existsSync(join(cwd, "openspec")) ? "openspec" : "plain";
}
