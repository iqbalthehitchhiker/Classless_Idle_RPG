/**
 * Combat simulation script for testing and tuning.
 * Usage: npx tsx scripts/sim.ts [seconds] [seed]
 * Defaults: 300 seconds, seed 1
 */
import { createInitialState, advance, dispatch, canChallengeBoss, deriveStats } from '../src/core/index.js';
import { defaultConfig } from '../src/data/index.js';
import type { LogEntry } from '../src/core/types.js';

const args = process.argv.slice(2);
const totalSeconds = args[0] ? parseFloat(args[0]) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 1;

/** Sim bot only presses Challenge Boss at/above this level (D22). */
const BOT_BOSS_LEVEL = 8;

const STEP = 0.1;
let state = createInitialState(seed, defaultConfig);

// M2-02: Print skill tree stats and test purchases
console.log('=== Skill Tree ===');
const totalNodes = defaultConfig.content.skillNodes.size;
let totalCost = 0;
for (const node of defaultConfig.content.skillNodes.values()) {
  totalCost += node.cost;
}
console.log(`Total nodes: ${totalNodes}`);
console.log(`Total cost of all nodes: ${totalCost}`);

// Give enough skill points and purchase a fixed path
state = { ...state, character: { ...state.character, skillPoints: totalCost } };

const statsBefore = deriveStats(state, defaultConfig);
console.log('\n=== Stats Before Purchases ===');
console.log(`Max HP: ${statsBefore.maxHp.toFixed(2)}`);
console.log(`Attack: ${statsBefore.attack.toFixed(2)}`);
console.log(`Attack Rate: ${statsBefore.attackRate.toFixed(2)}`);
console.log(`Crit Chance: ${(statsBefore.critChance * 100).toFixed(2)}%`);
console.log(`Crit Damage: ${statsBefore.critDamage.toFixed(2)}x`);

// Purchase: center root, then Berserker entry, then onward as far as points allow
const purchasePath = [
  'center-root',
  'center-attack-1',
  'center-hp-2',
  'center-crit-1',
  'center-attack-2',
  'berserker-entry',
  'berserker-crit-damage',
  // Skip berserker-attack-speed (requires proficiency)
  // Continue with remaining affordable nodes
  'center-hp-3',
  'paladin-entry',
  'paladin-hp-2',
];

for (const nodeId of purchasePath) {
  const node = defaultConfig.content.skillNodes.get(nodeId);
  if (!node) continue;
  
  // Skip nodes with proficiency requirements
  const hasProficiencyReq = node.requirements.some(req => req.kind === 'proficiency');
  if (hasProficiencyReq) continue;
  
  state = dispatch(state, { type: 'purchaseNode', nodeId }, defaultConfig);
}

const statsAfter = deriveStats(state, defaultConfig);
console.log('\n=== Stats After Purchases ===');
console.log(`Max HP: ${statsAfter.maxHp.toFixed(2)}`);
console.log(`Attack: ${statsAfter.attack.toFixed(2)}`);
console.log(`Attack Rate: ${statsAfter.attackRate.toFixed(2)}`);
console.log(`Crit Chance: ${(statsAfter.critChance * 100).toFixed(2)}%`);
console.log(`Crit Damage: ${statsAfter.critDamage.toFixed(2)}x`);
console.log(`Purchased nodes: ${state.purchasedNodes.length}`);
console.log(`Remaining skill points: ${state.character.skillPoints}`);

console.log('\n=== Starting Combat ===');
state = dispatch(state, { type: 'startActivity', activityId: 'combat', params: { stageId: defaultConfig.content.startingStageId } }, defaultConfig);

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

// Exercise stop/start mid-run (M1-12)
let stoppedAtTime: number | null = null;
let levelAtStop: number | null = null;
let xpAtStop: number | null = null;
let clearedStagesAtStop: readonly string[] | null = null;

while (time < totalSeconds) {
  // Challenge boss only at/above BOT_BOSS_LEVEL when eligible (D22); grind waves otherwise
  if (state.combat && state.character.level >= BOT_BOSS_LEVEL && canChallengeBoss(state, defaultConfig)) {
    state = dispatch(state, { type: 'challengeBoss' }, defaultConfig);
  }
  
  state = advance(state, STEP, defaultConfig);
  time += STEP;

  maxLogLength = Math.max(maxLogLength, state.log.length);

  // Stop at 120 s, then restart immediately
  if (time >= 120 && stoppedAtTime === null) {
    console.log(`\n[${time.toFixed(1)}s] Stopping combat...`);
    levelAtStop = state.character.level;
    xpAtStop = state.character.xp;
    clearedStagesAtStop = state.clearedStages;
    
    state = dispatch(state, { type: 'stopActivity' }, defaultConfig);
    stoppedAtTime = time;
    
    console.log(`[${time.toFixed(1)}s] Combat stopped. Restarting...`);
    state = dispatch(state, { type: 'startActivity', activityId: 'combat', params: { stageId: defaultConfig.content.startingStageId } }, defaultConfig);
    console.log(`[${time.toFixed(1)}s] Combat restarted.\n`);
  }

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
console.log(`Final wavesCleared counter: ${state.combat?.wavesCleared ?? 0}`);
console.log(`Max log length: ${maxLogLength}`);

// Report on preserved progress across stop/start
if (stoppedAtTime !== null && levelAtStop !== null && xpAtStop !== null && clearedStagesAtStop !== null) {
  const levelPreserved = state.character.level >= levelAtStop;
  const xpPreserved = state.character.xp >= xpAtStop;
  const clearedPreserved = clearedStagesAtStop.every(s => state.clearedStages.includes(s));
  const allPreserved = levelPreserved && xpPreserved && clearedPreserved;
  
  console.log(`\nProgress preserved across stop/start: ${allPreserved ? 'YES' : 'NO'} (level: ${levelPreserved}, xp: ${xpPreserved}, clearedStages: ${clearedPreserved})`);
}

// M1-13: Round-trip test
import { serialize, deserialize } from '../src/persistence/storage.js';

const serialized = serialize(state);
const deserialized = deserialize(serialized, defaultConfig);

if (!deserialized.ok) {
  console.log(`Round trip: FAILED - ${deserialized.error}`);
} else {
  const s1 = state;
  const s2 = deserialized.state;
  
  // Compare only D19 fields (no derived values, no combat runtime)
  const diffFields: string[] = [];
  
  // Character
  if (s1.character.level !== s2.character.level) diffFields.push('character.level');
  if (s1.character.xp !== s2.character.xp) diffFields.push('character.xp');
  if (s1.character.skillPoints !== s2.character.skillPoints) diffFields.push('character.skillPoints');
  if (s1.character.currentHp !== s2.character.currentHp) diffFields.push('character.currentHp');
  
  // Unlocked/cleared stages
  if (JSON.stringify(s1.unlockedStages) !== JSON.stringify(s2.unlockedStages)) diffFields.push('unlockedStages');
  if (JSON.stringify(s1.clearedStages) !== JSON.stringify(s2.clearedStages)) diffFields.push('clearedStages');
  
  // Settings
  if (s1.settings.autoProgress !== s2.settings.autoProgress) diffFields.push('settings.autoProgress');
  
  // Time
  if (s1.elapsedMs !== s2.elapsedMs) diffFields.push('elapsedMs');
  
  // RNG
  if (s1.rng.seed !== s2.rng.seed) diffFields.push('rng.seed');
  
  // Log
  if (JSON.stringify(s1.log) !== JSON.stringify(s2.log)) diffFields.push('log');
  
  // Activity
  if (s1.activeActivity !== s2.activeActivity) diffFields.push('activeActivity');
  
  // StageId (combat runtime stageId becomes null if no combat, or should match)
  const s1StageId = s1.combat?.stageId ?? null;
  const s2StageId = s2.combat?.stageId ?? null;
  if (s1StageId !== s2StageId) diffFields.push('stageId');
  
  if (diffFields.length === 0) {
    console.log('Round trip: OK');
  } else {
    console.log(`Round trip: FAILED - differing fields: ${diffFields.join(', ')}`);
  }
}
