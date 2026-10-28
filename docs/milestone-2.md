# Milestone 2: Skills, Disciplines, Requirements
Status: not started. Next: M2-01.

Goal: give the player the first real decisions. Prove that choosing where to spend points and what to train makes the game more engaging than watching combat alone (playtest-2's main finding).

Scope reference: SRS Phase 2, plus D21 (stages that need more than level). Mana, equipment, knowledge, and the economy are NOT in this milestone (Phase 3+).

## Rules for every task
- Read CLAUDE.md and docs/visual-decisions.md first; UI follows the tokens, and the report includes the hex/px grep results.
- One task per prompt. Commit only when `npm run typecheck && npm test && npm run build` all pass, and paste the real "Tests" line.
- If the same error survives 3 fix attempts: `git checkout -- <file>`, stop, and report. Never rewrite a whole file to fix a typo.
- Tests only for pure rule functions (modifier math, purchase guard, requirement check, migration). Everything else is verified by the sim script and by the owner in the UI.

## Decisions
D27 to D34 live in docs/decisions.md, which is authoritative. Do not copy them here.
Canonical branch names: center, paladin, berserker (D30).

## Tasks (do in order)

### Data and rules
- [ ] **M2-01 Content schemas.** Zod schemas and a starter set: disciplines (2), proficiency curve, skill nodes (about 16: a center group of general passives, a Berserker branch, a Paladin branch), with cross-reference validation (prerequisite ids exist, discipline ids exist, no prerequisite cycles). Node effect types in this milestone: flat or percent stat bonus (HP, attack, crit chance, attack speed, crit damage), and one effect that grants an on-hit effect (an "Ignite" node that adds burn through the existing `deriveOnHitEffects`). Report the current skill point grant rule.
  Owner check: the sim script still prints the same summary; content loads without errors.
- [ ] **M2-02 Modifiers and purchasing.** `deriveStats` includes purchased nodes per D28 (multiplier floored at 0, crit chance capped, attack speed minimum, both from data); `deriveOnHitEffects` includes node-granted effects. `purchaseNode` and `respec` actions in `dispatch`; purchase is rejected with a reason when points, prerequisites, or requirements are missing; `respec` is rejected with a reason while any activity is running (D29). Tests: modifier math including the clamps, and the purchase and respec guards only.
  Owner check: the sim buys a scripted set of nodes and prints before/after derived stats.
- [ ] **M2-03 Requirements.** The shared `Requirement` type and `checkRequirements(state, requirements, config)` returning ok or a list of unmet items (readable text for the UI). Used by nodes now; stage `requirements` field added (optional) and enforced in `startActivity`. Test the check function only.
  Owner check: stage 2 gets a requirement of Swordsmanship level 3 in starter data; the sim shows it being rejected, then accepted.

### Disciplines
- [ ] **M2-04 Proficiency and training.** Proficiency state per discipline with levels from the curve; Training becomes the second activity (registered in the static activities constant in core); combat trickle per D31; training also awards a small XP trickle. Switching activities preserves progress (FR-010).
  Owner check: sim runs 60 s of training and then 60 s of combat and prints proficiency and XP gains for both.

### Persistence
- [ ] **M2-05 Save v2.** Schema bumped to version 2 with purchased nodes and proficiency; migration from v1. Include a short migration test.
  Owner check: load your existing v1 save in the browser and confirm level, XP, and stages survive; then buy a node, reload, and confirm it persists.

### UI
- [ ] **M2-06 Skill tree and discipline panels.** An SVG skill tree with four node states (locked, available, owned, requirement-unmet, per A10), branch colors (A11), unmet requirements shown on hover or click (FR-107), a respec button with confirm, and a points counter. A discipline panel with proficiency bars and a Train button (Swordsmanship, Fortitude). Stage selector shows unmet requirements. Minimal, token-only styling.The respec button is disabled with the reason text ‘Stop combat to respec’ while an activity is running.
  Owner check: buy nodes, watch derived stats change in the character panel, train, and try the gated stage.

### Balance and debt
- [ ] **M2-07 Balance pass.** Extend the balance bot with two build strategies (all-Berserker, all-Paladin) and compare time to level 10 and boss win rate at level 5 per build. Targets: no build more than about 25% faster than the others; level 10 stays within 10 to 17 minutes. Revisit D24 (level growth now that nodes give power) and report a recommendation without changing it.Apply D34: `repeatBossXpFraction` in data (starter 0.1); the boss-kill handler reads "stage already cleared?" before adding to clearedStages. Repeat boss kills stop being an XP faucet, so expect to lower the level curve growth to keep level 10 within target.
- [ ] **M2-08 Debt paydown.** Branch coverage at least 90% on the combat files, step caps that throw in the boss test loops, mutation checks for the purchase guard, the requirement check, and the D18 heal, and the balance script's boss vs wave death split.

## Acceptance
- [ ] A purchase with missing points, prerequisites, or requirements is rejected with a visible reason.
- [ ] Derived stats follow D28 and change immediately after a purchase or respec.
- [ ] Training and combat both grow proficiency at their configured rates.
- [ ] A gated stage cannot be started until its requirement is met.
- [ ] A v1 save loads into v2 without losing progress; v2 round-trips.
- [ ] `npm test` passes, and core still has no non-type imports from data, persistence, or UI.
- [ ] Boss kill handler reads "stage already cleared?" BEFORE adding to clearedStages. Test: first kill awards the full bonus, second awards `repeatBossXpFraction` of it. (This is a pure rule check, so it gets a test despite the "tests only for rule functions" policy; it qualifies.)

## Fun check (the real exit test)
Play for 15 minutes, then write three lines in `docs/playtest-3.md`:
1. Did I make a choice I cared about (a node, a discipline, a build)?
2. Did the first gated stage feel like a goal or a wall?
3. Did I want to respec or restart to try a different build?

If the answers are no, the tree's content or costs need work before building more systems.
