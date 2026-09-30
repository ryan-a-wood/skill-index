---
name: next-skill
description: Use FIRST at the start of any software task, before writing or changing any code, and whenever you are unsure which skill or command to run next. Routes to the right skill or flow across the mattpocock and OpenSpec skills, resolved by the repo, so overlapping skills are never chosen ad hoc.
---

# Next skill

You do not have to remember which skill fits. Neither does the user. Read the
generated router and follow it.

Read this file before picking anything:

    ~/dev/skill-index/dist/ROUTER.md

If it is missing, tell the user to run `npm run build` in `~/dev/skill-index`.

## How to follow it

1. **Decide the repo context.** If the working directory contains an
   `openspec/` directory, use the OpenSpec flow. Otherwise use the Plain flow.
   Confirm with `node ~/dev/skill-index/bin/cli.ts context`.
2. **Walk that flow in order.** Invoke the skill or command at the step you
   have reached. Do not skip ahead; the order encodes the context hygiene.
3. **Resolve overlaps from the Capability map, not by preference.** The table
   already pairs each capability for the current context. Never pick between
   two overlapping skills on your own.
4. **Bind `/tdd` into OpenSpec apply.** `/opsx:apply` has no test-first
   discipline, so when you reach that step, drive `/tdd` one red-green slice
   per task. This composition lives in this router on purpose: the files
   OpenSpec generates are rewritten by `openspec update` and would clobber it.

## The shared primitives

Both flows end up in the same place, and these skills are how work actually
gets done and closed:

- `/tdd` - build a behaviour test-first, one red-green slice at a time.
- `/code-review` - two-axis review (Standards + Spec) of the diff.
- `/retro` - close the loop by improving the environment, not the code.

## Off the main flow

Reach for these the moment the situation calls for them, without asking:

- Something is broken and resists a first glance -> `/diagnosing-bugs`.
- Bugs and requests you did not create are piling up -> `/triage`.
- A huge, foggy effort too big for one session -> `/wayfinder`.
- A spare moment to keep the codebase good for agents ->
  `/improve-codebase-architecture`.
- A design question that needs a runnable answer -> `/prototype`.
- A question about what the right API or fact is -> `/research`.
- Steps only a human can take (secrets, dashboards, cutovers) -> `/wizard`.
- Porting work to a new harness, directory, or colleague -> `/handoff`.

## Editing the router

`dist/ROUTER.md` is generated. Never edit it by hand: it is overwritten on
every build. Edit `~/dev/skill-index/taxonomy.yml` and run
`npm run build` in `~/dev/skill-index`. Adding or removing a skill, or
changing a flow, is a taxonomy edit.
