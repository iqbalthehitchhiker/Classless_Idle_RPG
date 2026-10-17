/**
 * Combat simulation script for testing and tuning.
 * Usage: npx tsx scripts/sim.ts [seconds] [seed]
 * Defaults: 300 seconds, seed 1
 */
import { createInitialState, advance, dispatch } from '../src/core/engine.js';
import { defaultConfig } from '../src/data/index.js';
import type { GameState } from '../src/core/types.js';

const args = process.argv.slice(2);
const totalSeconds = args[0] ? parseFloat(args[0]) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 1;

const STEP = 0.1;
let state = createInitialState(seed, defaultConfig);
state = dispatch(state, { type: 'startCombat', stageId: defaultConfig.content.startingStageId }, defaultConfig);

let time = 0;
let prevState = state;

while (time < totalSeconds) {
  state = advance(state, STEP, defaultConfig);
  time += STEP;

  if (!state.combat) break;

  const combat = state.combat;
  const prevCombat = prevState.combat;

  // Enemy killed (enemies array shrinks)
  if (prevCombat && prevCombat.enemies.length > combat.enemies.length && combat.enemies.length > 0) {
    console.log(`${time.toFixed(1)}s: Enemy killed`);
  }

  // Wave cleared (waveIndex increments or boss spawn)
  if (prevCombat && prevCombat.waveIndex < combat.waveIndex) {
    console.log(`${time.toFixed(1)}s: Wave ${prevCombat.waveIndex + 1} cleared`);
  }

  // Boss spawned
  if (prevCombat?.phase.type !== 'boss' && combat.phase.type === 'boss') {
    console.log(`${time.toFixed(1)}s: Boss spawned`);
  }

  // Boss killed (boss phase -> active phase with stage progression or loop)
  if (prevCombat?.phase.type === 'boss' && combat.phase.type === 'active' && combat.waveIndex === 0) {
    console.log(`${time.toFixed(1)}s: Boss killed`);
  }

  // Stage unlocked (check unlockedStages array growth)
  if (state.unlockedStages.length > prevState.unlockedStages.length) {
    const newStage = state.unlockedStages[state.unlockedStages.length - 1];
    console.log(`${time.toFixed(1)}s: Stage unlocked: ${newStage}`);
  }

  // Level up
  if (state.character.level > prevState.character.level) {
    console.log(`${time.toFixed(1)}s: Level up -> ${state.character.level}`);
  }

  // Player defeated (entering recovery phase)
  if (prevCombat?.phase.type !== 'recovering' && combat.phase.type === 'recovering') {
    console.log(`${time.toFixed(1)}s: Player defeated, retreating to wave ${combat.waveIndex + 1}`);
  }

  // Recovery ended
  if (prevCombat?.phase.type === 'recovering' && combat.phase.type === 'active') {
    console.log(`${time.toFixed(1)}s: Recovery complete`);
  }

  prevState = state;
}

// Summary
let deaths = 0;
let wavesCleared = 0;
let bossKills = 0;

// Re-run to count events
state = createInitialState(seed, defaultConfig);
state = dispatch(state, { type: 'startCombat', stageId: defaultConfig.content.startingStageId }, defaultConfig);
time = 0;
prevState = state;

while (time < totalSeconds) {
  state = advance(state, STEP, defaultConfig);
  time += STEP;

  if (!state.combat) break;

  const combat = state.combat;
  const prevCombat = prevState.combat;

  if (prevCombat && prevCombat.waveIndex < combat.waveIndex) {
    wavesCleared++;
  }

  if (prevCombat?.phase.type === 'boss' && combat.phase.type === 'active' && combat.waveIndex === 0) {
    bossKills++;
  }

  if (prevCombat?.phase.type !== 'recovering' && combat.phase.type === 'recovering') {
    deaths++;
  }

  prevState = state;
}

console.log('\n=== Summary ===');
console.log(`Level: ${state.character.level}`);
console.log(`XP: ${state.character.xp}`);
console.log(`Deaths: ${deaths}`);
console.log(`Waves cleared: ${wavesCleared}`);
console.log(`Boss kills: ${bossKills}`);
console.log(`Final stage: ${state.combat?.stageId || 'none'}`);
