# Milestone 2: Skills, Disciplines, Requirements
Status: M2-01 to M2-06 built. Next: M2-06a (fix tree UI), then M2-06b, M2-07 to M2-09.

Goal: give the player the first real decisions. Prove that choosing where to spend points and what to train makes the game more engaging than watching combat alone (playtest-2's main finding).

Scope reference: SRS Phase 2, plus D21 (stages that need more than level). Mana, equipment, knowledge, and the economy are NOT in this milestone (Phase 3+).

## Rules for every task
- Read CLAUDE.md and docs/visual-decisions.md first; UI follows the tokens, and the report includes the hex/px grep results.
- One task per prompt. Commit only when `npm run typecheck && npm test && npm run build` all pass, and paste the exact last line of typecheck and the exact "Tests" line.
- If the same error survives 3 fix attempts: `git checkout -- <file>`, stop, and report. Never rewrite a whole file to fix a typo.
- Tests only for pure rule functions (modifier math, purchase guard, requirement check, migration). Everything else is verified by the sim script and by the owner in the UI.

## Decisions
D27 to D39 live in docs/decisions.md, which is authoritative. Do not copy them here.
Canonical branch names: center, paladin, berserker (D30).

## Tasks (do in order)

### Data and rules
- [x] **M2-01 Content schemas.** Zod schemas and a starter set: disciplines (2), proficiency curve, skill nodes (16: a center group of general passives, a Berserker branch, a Paladin branch), with cross-reference validation (prerequisite ids exist, discipline ids exist, no prerequisite cycles). Node effect types: flat or percent stat bonus (HP, attack, crit chance, attack speed, crit damage), and one effect that grants an on-hit effect (an "Ignite" node that adds burn through `deriveOnHitEffects`).
- [x] **M2-02 Modifiers and purchasing.** `deriveStats` includes purchased nodes per D28 (multiplier floored at 0, crit chance capped, attack speed minimum, both from data); `deriveOnHitEffects` includes node-granted effects. `purchaseNode` and `respec` actions in `dispatch`; purchase is rejected with a reason when points or prerequisites are missing; `respec` is rejected with a reason while any activity is running (D29).
- [x] **M2-03 Requirements.** The shared `Requirement` type and `checkRequirements(state, requirements, config)` returning ok or a list of unmet items (readable text for the UI). Used by nodes; stage `requirements` field (optional) enforced in `startActivity`. Stage 2 requires Swordsmanship level 3.

### Disciplines
- [x] **M2-04 Proficiency and training.** Proficiency state per discipline with levels from the curve; Training is the second activity (registered in the static activities constant in core); training also awards a small XP trickle; combat Swordsmanship trickle per D31 (superseded by D39 in M2-07). Switching activities preserves progress (FR-010).

### Persistence
- [x] **M2-05 Save v2.** Schema version 2 with purchased nodes, proficiency, and activity params (D35); migration from v1 with tests.

### UI
- [x] **M2-06 Skill tree and discipline panels.** SVG skill tree with four node states (locked, available, owned, requirement-unmet, per A10), branch colors (A11), unmet requirements on click (FR-107), a respec button with confirm, a points counter, a discipline panel with proficiency bars and Train buttons, and a stage selector that shows unmet requirements. The respec button is disabled with the reason 'Stop combat to respec' while an activity is running. Built, but the owner's playtest found it non-functional (see M2-06a).
- [ ] **M2-06a Fix tree UI.** Owner playtest: clicking a node shows nothing in the detail panel, skill points cannot be spent, Respec does nothing. Likely cause: non-reactive Svelte state (`showConfirm` and similar not declared with `$state`). Also fix the 6 svelte-check warnings without deleting styles. UI only.
- [ ] **M2-06b Sidebar layout (D36).** One view at a time chosen from a sidebar (Combat, Character, Skills, Disciplines, Settings/Save), a compact status strip (stage, wave, HP, activity, timers) visible in every view, clutter removed.
  Owner check (after 06a and 06b): buy nodes and watch derived stats change, train a discipline, try the gated stage, respec, reload and confirm everything persists.

### Sub-disciplines
- [ ] **M2-07 Sub-disciplines (D37 to D39).** Schemas and Swordsmanship data (batch 1 effects: Edge Alignment, Bi-directional Cutting, Stepping & Lunge, Guard Postures), derived discipline XP (sum of sub-skill levels x 2, not saved), training params become subSkillId, combat proficiency trickle removed (D39), save v3 with migration, sub-skill UI in the Disciplines view, flatter proficiency curve. Fortitude stays flat until sub-skills are written for it (owner decision).
  Owner check: train one sub-skill, watch the discipline level rise, and see a gated node or stage unlock because of it.

### Balance and debt
- [ ] **M2-08 Balance pass.** Extend the balance bot with two build strategies (all-Berserker, all-Paladin) and compare time to level 10 and boss win rate at level 5 per build. Targets: no build more than about 25% faster than the others; level 10 stays within 10 to 17 minutes. Revisit D24 (level growth now that nodes give power) and report a recommendation without changing it. Apply D34: `repeatBossXpFraction` in data (starter 0.1); the boss-kill handler reads "stage already cleared?" before adding to clearedStages. Repeat boss kills stop being an XP faucet, so expect to lower the level curve growth to keep level 10 within target.
- [ ] **M2-09 Debt paydown.** Branch coverage at least 90% on the combat files, step caps that throw in the boss test loops, mutation checks for the purchase guard, the requirement check, and the D18 heal, and the balance script's boss vs wave death split.

## Acceptance
- [ ] A purchase with missing points, prerequisites, or requirements is rejected with a visible reason.
- [ ] Derived stats follow D28 and change immediately after a purchase or respec.
- [ ] Training grows proficiency at its configured rate (the combat trickle is removed by D39).
- [ ] A gated stage cannot be started until its requirement is met.
- [ ] A v1 save loads into the latest version without losing progress; the latest version round-trips.
- [ ] `npm test` passes, `npm run typecheck` ends with 0 errors and 0 warnings, and core still has no non-type imports from data, persistence, or UI.
- [ ] Boss kill handler reads "stage already cleared?" BEFORE adding to clearedStages. Test: first kill awards the full bonus, second awards `repeatBossXpFraction` of it. (This is a pure rule check, so it gets a test despite the "tests only for rule functions" policy; it qualifies.)

## Fun check (the real exit test)
Play for 15 minutes, then write three lines in `docs/playtest-3.md`:
1. Did I make a choice I cared about (a node, a discipline, a build)?
2. Did the first gated stage feel like a goal or a wall?
3. Did I want to respec or restart to try a different build?

If the answers are no, the tree's content or costs need work before building more systems.
