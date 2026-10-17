/**
 * Combat simulation script for testing and tuning.
 * Usage: npx tsx scripts/sim.ts [seconds] [seed]
 * Defaults: 300 seconds, seed 1
 */
import { createInitialState, advance, dispatch } from '../src/core/engine.js';
import { defaultConfig } from '../src/data/index.js';
import type { LogEntry } from '../src/core/types.js';

const args = process.argv.slice(2);
const totalSeconds = args[0] ? parseFloat(args[0]) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 1;

const STEP = 0.1;
let state = createInitialState(seed, defaultConfig);
state = dispatch(state, { type: 'startCombat', stageId: defaultConfig.content.startingStageId }, defaultConfig);

function newEntries(log: readonly LogEntry[], last: LogEntry | null): readonly LogEntry[] {
  if (last === null) return log;
  const index = log.indexOf(last);
  return index === -1 ? log : log.slice(index + 1);
}

let time = 0;
let lastPrinted: LogEntry | null = null;
let maxLogLength = 0;

let enemyKills = 0;
let wavesCleared = 0;
let bossKills = 0;
let stageUnlocks = 0;
let levelUps = 0;
let deaths = 0;

while (time < totalSeconds) {
  state = advance(state, STEP, defaultConfig);
  time += STEP;

  maxLogLength = Math.max(maxLogLength, state.log.length);

  if (!state.combat) break;

  for (const entry of newEntries(state.log, lastPrinted)) {
    console.log(`${(entry.tMs / 1000).toFixed(1)}s: ${entry.detail}`);

    switch (entry.type) {
      case 'enemyKilled':
        enemyKills++;
        break;
      case 'waveCleared':
        wavesCleared++;
        break;
      case 'bossSpawned':
        break;
      case 'bossKilled':
        bossKills++;
        break;
      case 'stageUnlocked':
        stageUnlocks++;
        break;
      case 'levelUp':
        levelUps++;
        break;
      case 'playerDefeated':
        deaths++;
        break;
      case 'recoveryEnded':
        break;
    }

    lastPrinted = entry;
  }
}

console.log('\n=== Summary ===');
console.log(`Level: ${state.character.level}`);
console.log(`XP: ${state.character.xp}`);
console.log(`Deaths: ${deaths}`);
console.log(`Waves cleared: ${wavesCleared}`);
console.log(`Boss kills: ${bossKills}`);
console.log(`Enemy kills: ${enemyKills}`);
console.log(`Level ups: ${levelUps}`);
console.log(`Stage unlocks: ${stageUnlocks}`);
console.log(`Final stage: ${state.combat?.stageId || 'none'}`);
console.log(`Max log length: ${maxLogLength}`);
