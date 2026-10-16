# Handoff: set up the toolkit inventory flow on the work laptop

For a fresh agent on the work laptop. Goal: after cloning this repo, reproduce the flow that keeps a Notion "Toolkit Inventory" database in step with the skills, plugins, mods and MCP servers installed on disk.

The repo already documents its own scripts. Read these first and don't restate them:

- [`README.md`](../README.md): what `sync:skills` and the three `inventory` scripts do.
- [`bin/inventory.ts`](../bin/inventory.ts): what it scans, how drift is computed, where snapshots live (`~/.agents/.toolkit-inventory.json` and `.toolkit-inventory.synced.json`).
- [`bin/sync-skills.ts`](../bin/sync-skills.ts): symlinks canonical skills into each harness.

Everything below is configuration that lives **outside** this repo on the personal Mac, copied here so it exists on the work laptop.

## The flow

1. **Disk is the source of truth.** `npm run inventory:check` is the deterministic check. It prints a Claude Code `systemMessage` only when disk differs from the last reconciled snapshot.
2. **A SessionStart hook** runs that check on every new session, so drift shows up right away.
3. **A daily scheduled task** in the Claude desktop app reconciles Notion and marks the snapshot synced.
4. **A rule in global `CLAUDE.md`** makes any agent reconcile right away after it installs or removes something, instead of waiting for the daily run.
5. **Notion holds the human columns.** New rows land with Status = Review. A person fills in Use when, Works with and Area.

## Setup steps

1. Clone to `~/dev/skill-index`. The hook, the task and the CLAUDE.md rule all assume that path. Run `npm install`.
2. Check that Node runs `.ts` files directly (`node bin/inventory.ts`). Node 26.5 does on the personal Mac. If it doesn't, upgrade Node rather than adding a build step.
3. Decide which Notion workspace to use (see "Open decisions" below). If it's a new workspace, recreate the database first.
4. Add the hook to `~/.claude/settings.json` (merge it into any existing `hooks`):

   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "matcher": "startup",
           "hooks": [
             {
               "type": "command",
               "command": "node \"$HOME/dev/skill-index/bin/inventory.ts\" --check",
               "timeout": 10
             }
           ]
         }
       ]
     }
   }
   ```

5. Add this line to `~/.claude/CLAUDE.md`:

   > After installing, removing or moving any skill, plugin, mod or MCP server, run `npm --prefix ~/dev/skill-index run inventory`, update the Notion "Toolkit Inventory" database to match, then run `npm --prefix ~/dev/skill-index run inventory:synced`. Never overwrite the Use when, Works with or Notes columns.

6. In the Claude desktop app, connect Notion. Then create a scheduled task named **Reconcile toolkit inventory**, daily at 09:00, using the prompt below. Swap in the work data source ID if it's a new database.
7. Do the first run (see "First run" below).

## Notion database schema

Personal workspace:

- Page: **AI Agent Toolkit**, `https://app.notion.com/p/3f9a141a56e381c5abc4c5ea1d4903d2`
- Database: **Toolkit Inventory**, `https://app.notion.com/p/93c857b5cd1f44918a7916a89d97feba`
- Data source: `collection://cf72f789-3688-48b6-92db-46d913077648`

To recreate it, use these exact property names. Option names must match too, because the script's `kind` values map 1:1 onto Kind.

| Property | Type | Options |
|---|---|---|
| Name | title | |
| Kind | select | Skill, Plugin, Mod, MCP server |
| Status | select | Active, Review, Removed |
| Harnesses | multi-select | Claude Code, opencode, Codex, Cursor |
| Area | select | Workflow, OpenSpec, Cloudflare, Browser & perf, Planning, AI features, Meta (adjust for work) |
| Canonical path | text | |
| Source | text | |
| Installed | date | |
| Use when | text | |
| Works with | text | |
| Notes | text | |

## Scheduled task prompt

Copied as-is from `~/.claude/scheduled-tasks/reconcile-toolkit-inventory/SKILL.md`. Replace the `collection://` ID and the database URL if you're using a work database.

```markdown
Keep the Notion "Toolkit Inventory" database in step with what's installed on this Mac. Keep it cheap: no subagents, and stop as early as you can.

1. Run `node ~/dev/skill-index/bin/inventory.ts --check`. If it prints nothing, there's no drift. Reply "No toolkit drift." and stop.

2. Otherwise run `node ~/dev/skill-index/bin/inventory.ts`. It prints a JSON array of entries with {kind, name, harnesses, path, source}. `kind` is one of Skill, Plugin, Mod or MCP server, and these match the Notion Kind options exactly.

3. Use the Notion connector to query the data source collection://cf72f789-3688-48b6-92db-46d913077648 (database "Toolkit Inventory", inside the page "AI Agent Toolkit"). SQL: SELECT url, Name, Kind, Status, Harnesses, "Canonical path" FROM it. Match rows to entries by Kind plus Name, case-insensitive.

4. Reconcile:
   - Entry with no row: create a row with Name, Kind, Harnesses (JSON array), Canonical path = path, Source = source, Installed = today's date, Status = "Review", Notes = "Added by inventory reconcile. Needs Use when / Works with."
   - Row with Status Active or Review and no matching entry: set Status = "Removed". Don't delete the row.
   - Row with Status Removed whose entry has come back: set Status = "Review".
   - Matched row whose Harnesses or Canonical path differs: update only those two properties.
   - Never change "Use when", "Works with", "Notes" or "Area" on existing rows.

5. When Notion is updated, run `node ~/dev/skill-index/bin/inventory.ts --mark-synced`.

6. Reply with one line per change, for example "+ Skill foo (Review)", "- Plugin bar (Removed)" or "~ MCP server baz harnesses". If any rows are now in Review, end with "Fill in Use when / Works with for the Review rows: https://app.notion.com/p/93c857b5cd1f44918a7916a89d97feba".
```

## First run

A fresh machine has no `~/.agents/.toolkit-inventory.synced.json`, so `--check` reports every install as added. That's expected.

- **New work database:** run the scheduled task once with Run now. Every install becomes a Review row.
- **Sharing the personal database:** don't. The work machine would mark personal-only items Removed and the personal machine would mark them back, every day. Use a separate database, or add a Machine property and filter by it, which means changing the prompt and the matching rule.

## Open decisions for the user

- **Which workspace:** a separate work Notion workspace and database (recommended), or the personal one with a Machine column.
- **Skills to reinstall:** what to install on the work laptop. Personal skills are tracked in `~/.agents/.skill-lock.json` (from the `skills` CLI), which isn't in this repo.
- **Other harnesses:** whether work uses harnesses other than Claude Code and opencode. Codex and Cursor exist as Notion options, but `bin/inventory.ts` doesn't scan them yet.

## Known gaps

- The local scheduled task only runs while the desktop app is open and the Mac is awake. Missed days are caught on the next run, because the check compares snapshots, not events.
- The "Keeping this current" section on the personal AI Agent Toolkit page still describes the old method of asking an agent to scan by hand. It doesn't mention the script, the hook or the task.
- This repo has no git remote yet. It needs one before it can be cloned anywhere.

## Suggested skills

- `schedule`: create the daily "Reconcile toolkit inventory" task.
- `update-config`: add the SessionStart hook to `~/.claude/settings.json` safely.
- `writing-for-agents`: when editing the global `CLAUDE.md` line or the task prompt.
- `wizard`: if the Notion connector and workspace setup needs steps only the user can do.

## Also on the work laptop

The Skill Interchange page (a "which skill next" map) is separate from this flow. To recreate it, see [`skill-interchange.md`](skill-interchange.md).
