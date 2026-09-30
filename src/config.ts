import { homedir } from "node:os";
import { join } from "node:path";

export function defaultRoots(): string[] {
  const home = homedir();
  return [
    join(home, ".agents", "skills"),
    join(home, ".config", "opencode", "skills"),
    join(home, ".claude", "skills"),
  ];
}

export function projectRoots(cwd: string): string[] {
  return [
    join(cwd, ".opencode", "skills"),
    join(cwd, ".claude", "skills"),
    join(cwd, ".agents", "skills"),
  ];
}

export function defaultLockfilePath(): string {
  return join(homedir(), ".agents", ".skill-lock.json");
}
