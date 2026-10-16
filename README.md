# skill-index

Keeps one real copy of each agent skill and symlinks it into every harness.

- Canonical location: `~/.agents/skills/` (where the `skills` CLI installs).
- Skills written by hand go in this repo's `skills/` folder.
- `npm run sync:skills` links them into `~/.claude/skills` and `~/.config/opencode/skills`. It's idempotent and only ever replaces symlinks.

Run it after installing or removing a skill.

The catalogue of what's installed, and how the pieces fit together, lives in Notion: **AI Agent Toolkit** (https://app.notion.com/p/3f9a141a56e381c5abc4c5ea1d4903d2). The earlier router (`taxonomy.yml`, `ROUTER.md`, the `next-skill` skill) was removed on 2026-10-14; it's in git history.

## Keeping Notion in step

`bin/inventory.ts` reads disk (skills, Claude/opencode plugins, mods, MCP servers) — disk is the source of truth.

- `npm run inventory`: write `~/.agents/.toolkit-inventory.json` and print it.
- `npm run inventory:check`: compare with the last reconciled snapshot (`~/.agents/.toolkit-inventory.synced.json`); prints a Claude Code hook `systemMessage` on drift, nothing otherwise.
- `npm run inventory:synced`: record the current snapshot as reconciled.

A daily scheduled task ("Reconcile toolkit inventory") updates the Notion database and marks it synced. A SessionStart hook running `inventory:check` flags drift in between.

Setting this up on another machine: see [docs/work-laptop-handoff.md](docs/work-laptop-handoff.md).
