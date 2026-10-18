# Design Decisions (Phase 1)

Status: RESOLVED = implement as written. OPEN = needs owner input; do not guess.

| # | Topic | Decision | Status |
|---|---|---|---|
| D1 | Player defeat | Retreat one wave (min wave 1), full heal, 3 s recovery pause. Values in config (`defeat.retreatWaves`, `defeat.pauseSeconds`). Boss defeat sends player to the stage's last wave. | RESOLVED |
 D2 | Combat continuation | Regular waves loop endlessly for grinding. The boss is entered only by the player pressing Challenge Boss. After a boss kill, return to the wave loop. `autoProgress` (default off) moves to the next stage on boss kill. | RESOLVED |
| D3 | Combat grants proficiency | Deferred to Phase 2 (no disciplines exist in Phase 1). Plan: small trickle, training 3-5x faster. | DEFERRED |
| D4 | Big numbers | Native numbers. All arithmetic through `core/num.ts`. | RESOLVED |
| D5 | UI framework | Svelte. | RESOLVED |
| D6 | Simulation step | Fixed internal step of 0.1 s. `advance(state, seconds)` loops whole steps and carries the remainder. Max 10 s processed per call (guards background-tab bursts). | RESOLVED |
| D7 | Effect model | Effects are explicit timed objects (duration, tick interval, stacking rule). No average-DPS shortcuts. Offline later will be limited to training activities first. | RESOLVED |
| D8 | Stacking default | Burn refreshes duration and does not stack intensity. Configurable per effect (`stacking: "refresh" | "stack" | "ignore"`). | RESOLVED |
| D9 | Offline progression | Not implemented. Save `savedAt` timestamp only. | RESOLVED |
| D10 | Save export/import | Optional polish, last task. | RESOLVED |
| D11 | Phase 1 content size | 1 stage, 3 waves, 1 boss, 3 enemy types, 1 player-side effect (Burn), 1 enemy effect (Stun on boss). | RESOLVED |
| D12 | Level curve | `xpToNext(level) = round(50 * 1.35^(level-1))`. Tunable in data. Skill points are granted but unspent until Phase 2. | RESOLVED |
| D13 | Mana spending | Phase 3 must include at least one mana-costed skill, otherwise mana does nothing. | OPEN (carry to Phase 3) |
| D14 | Simultaneous deaths | If the player and the last enemy of the current wave would both die in the same step, the player wins: not defeated, wave advances, and the D18 heal applies. Outside a tie, DoT can kill the player. | RESOLVED |
| D15 | Level-up mid-fight | Max HP increases, current HP unchanged. Superseded at the moment of a wave clear by D18. | RESOLVED |
| D17 | Boss rewards | Boss XP bonus is awarded on every boss kill. The stage unlock happens only on the first kill. | RESOLVED |
| D18 | Wave-clear heal | When a wave is cleared (next wave, boss spawn, or stage completion/reset), player HP is fully restored to derived maxHp. `combat.playerHp` and `character.currentHp` update together. maxHp is computed from the latest state after the clearing kill's XP, so a mid-step level-up counts. Player effects are not cleared (D16). | RESOLVED |
| D19 | What a save contains | Progression only: character, unlockedStages, clearedStages, settings, elapsedMs, rng, log, activeActivity and its stageId. Combat runtime (enemies, effects, timers) is NOT saved. On load, an active combat restarts at wave 0 of the saved stage with full HP. | RESOLVED |
| D20 | Bad saves | A save that fails validation is never overwritten. It is copied to a separate "corrupt" key, the player sees an error, and autosave stays off until the player picks Reset. | RESOLVED |
| D21 | Anti-grind progression | Stage progress should not depend on level alone. Preferred tools: (1) optional `requirements` on stages (proficiency, knowledge, gear), (2) enemy scaling that outpaces level-only power, (3) diminishing XP when overleveled. Hard gates only where needed. Not implemented in Phase 1; revisit in Phase 2 with the skill tree. | OPEN |
| D22 | Challenge Boss availability | The button is enabled when the stage is already in clearedStages, OR the wave loop has cleared at least `minWavesBeforeBoss` waves this session (per-stage data, starter value 5 for testing; real target 50). The counter resets when combat is started or stopped, and is not reset by player death. A defeat in the boss fight returns the player to the wave loop at its first wave, after the recovery pause. | RESOLVED |
| D23 | Level-up stat bonuses | Leveling directly raises only max HP and Attack. Attack speed and crit chance do not scale with level; they come from gear, items and other systems. | RESOLVED |
| D24 | Per-level growth | HP 8% and attack 7% per level are PLACEHOLDERS, fine for levels 1-10 and wrong for 50-100. Frozen during M1-15. Revisit when skills, gear and items exist. Attack speed and crit have no level growth (D23). | OPEN |