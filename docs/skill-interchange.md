# Handoff: recreate the Skill Interchange page on another machine or account

For a fresh agent on the work laptop. **Skill Interchange** is a single-page "which skill next" map. You pick your situation and a highway-style sign names the next skill to run. Clicking any sign shows what that skill does, when to reach for it, and where it leads.

- Source: [`docs/skill-interchange/index.html`](skill-interchange/index.html). Self-contained, except for Google Fonts (Overpass). It opens straight from disk in any browser.
- Original: a private claude.ai artifact on the personal account, `https://claude.ai/artifact/KB9Y1s4z4tpBXew5TR5UdX`, saved 2026-10-16. The work account can't open it unless it's shared. The repo copy is the source of truth from now on.

It is **not** connected to the Notion inventory flow in [`work-laptop-handoff.md`](work-laptop-handoff.md). Every skill on the page is typed in by hand, so the page has to be edited whenever the installed skills change.

## 1. Install the skills it describes

The page only makes sense if these skills are installed. Both packages come from the `skills` CLI, which writes to `~/.agents/skills` and `~/.agents/.skill-lock.json`:

```bash
npx skills add mattpocock/skills
npx skills add cloudflare/skills
npm --prefix ~/dev/skill-index run sync:skills
```

The last command symlinks them into `~/.claude/skills` (see the [README](../README.md)).

- `mattpocock/skills` provides the main flow, on-ramps, upkeep, standalone skills and writing skills, plus `ask-matt`. The page's layout is copied from `ask-matt`'s SKILL.md.
- `cloudflare/skills` provides the purple "Platform and tooling" rows, along with `web-perf`. `setup-pre-commit` also sits in that section but comes from `mattpocock/skills`.

If the work laptop installs a different set, edit the page as described in step 3 rather than leaving dead signs.

## 2. Publish it on the work Claude account

Choose whichever applies:

- **Claude Code desktop app with Artifacts:** open this repo and ask Claude to "publish `docs/skill-interchange/index.html` as an artifact" (icon: `map`). That creates a new private URL on the work account. Republishing from the same session updates it in place. Add the new URL to this doc.
- **claude.ai web or desktop chat:** upload the HTML file and ask Claude to turn it into an artifact. The result is the same.
- **No artifacts allowed at work:** open the file locally (`open docs/skill-interchange/index.html`) or bookmark the file URL. Nothing on the page needs a server.

Don't publish it publicly from a work account without checking your company's policy. It lists your tools, but nothing sensitive.

## 3. Edit or regenerate it for a different skill set

All the content is in the `<script>` near the bottom of `index.html`, apart from the static map in `<main>`.

- `SK` has one entry per skill, keyed by skill name:
  - `cat`: one of `main`, `ramp`, `up`, `solo`, `vocab`, `plat`. Each maps to a sign colour through `CAT`.
  - `does`, `when`: one sentence each, from that skill's SKILL.md.
  - `next`: a list of skill names, drawn as "Leads to" signs. Every name must exist in `SK`.
  - `auto: true`: the agent can invoke the skill on its own. Use this when its SKILL.md lacks `disable-model-invocation: true`.
  - `note`: optional, shown as a yellow callout.
- `GROUPS` holds the "Where are you?" picker as `[label, skillName, optionalNote]` rows. `"#phase"` scrolls to the phase-boundary section.
- The static HTML in `<main>` (the road, forks, ramps and index rows) uses `data-s="<skill>"` buttons. The sign colour comes from its class: none (green), `b`, `o`, `n`, `w`, `p`.

To regenerate rather than hand-edit, ask an agent:

> Read every `~/.claude/skills/*/SKILL.md` and `~/.agents/skills/ask-matt/SKILL.md`, then update `docs/skill-interchange/index.html`. Add a `SK` entry and a row for each installed skill that's missing, remove entries for skills that aren't installed, and keep the layout and styling. Check that every `next` and `data-s` name resolves to an `SK` entry.

Afterwards, open the page and click through each section. A sign that leads nowhere means a name doesn't match.

## Open questions

- Does the work Claude plan allow Artifacts, and may they be shared inside the org? This only affects which option in step 2 to use.
- Should the page be generated from the Notion Toolkit Inventory instead, so it can't drift? Not built. Today it's hand-maintained.

## Suggested skills

- `artifact-design`: before republishing or restyling the page.
- `writing-for-agents`: if you change the regenerate prompt into a skill.
- `run`, or open the file in the built-in browser: to click through the page after edits.
