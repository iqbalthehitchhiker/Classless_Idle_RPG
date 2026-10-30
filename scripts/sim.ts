/**
 * Combat simulation script for testing and tuning.
 * Usage: npx tsx scripts/sim.ts [seconds] [seed]
 * Defaults: 300 seconds, seed 1
 */
import { createInitialState, advance, dispatch, canChallengeBoss, deriveStats, canStartStage } from '../src/core/index.js';
import { defaultConfig } from '../src/data/index.js';
import type { LogEntry } from '../src/core/types.js';

const args = process.argv.slice(2);
const totalSeconds = args[0] ? parseFloat(args[0]) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 1;

/** Sim bot only presses Challenge Boss at/above this level (D22). */
const BOT_BOSS_LEVEL = 8;

const STEP = 0.1;

/** Advance by up to 10 seconds per call (the advance() cap), looping as needed. */
function advanceSeconds(state: ReturnType<typeof createInitialState>, seconds: number, config: typeof defaultConfig): ReturnType<typeof createInitialState> {
  let s = state;
  let remaining = seconds;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 10);
    s = advance(s, chunk, config);
    remaining -= chunk;
  }
  return s;
}

function newEntries(log: readonly LogEntry[], last: LogEntry | null): readonly LogEntry[] {
  if (last === null) return log;
  const index = log.indexOf(last);
  return index === -1 ? log : log.slice(index + 1);
}

// ============================================================================
// BASELINE (fresh state — just combat, no skill tree purchases)
// ============================================================================

console.log('=== Baseline ===');
let state = createInitialState(seed, defaultConfig);

state = dispatch(state, { type: 'startActivity', activityId: 'combat', params: { stageId: defaultConfig.content.startingStageId } }, defaultConfig);

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
  if (state.combat && state.character.level >= BOT_BOSS_LEVEL && canChallengeBoss(state, defaultConfig)) {
    state = dispatch(state, { type: 'challengeBoss' }, defaultConfig);
  }

  state = advance(state, STEP, defaultConfig);
  time += STEP;

  maxLogLength = Math.max(maxLogLength, state.log.length);

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
      case 'enemyKilled': enemyKills++; break;
      case 'waveCleared': wavesCleared++; break;
      case 'bossSpawned': break;
      case 'bossKilled': bossKills++; break;
      case 'stageUnlocked': stageUnlocks++; break;
      case 'levelUp': levelUps++; break;
      case 'playerDefeated': deaths++; break;
      case 'recoveryEnded': break;
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

  const diffFields: string[] = [];

  if (s1.character.level !== s2.character.level) diffFields.push('character.level');
  if (s1.character.xp !== s2.character.xp) diffFields.push('character.xp');
  if (s1.character.skillPoints !== s2.character.skillPoints) diffFields.push('character.skillPoints');
  if (s1.character.currentHp !== s2.character.currentHp) diffFields.push('character.currentHp');

  if (JSON.stringify(s1.unlockedStages) !== JSON.stringify(s2.unlockedStages)) diffFields.push('unlockedStages');
  if (JSON.stringify(s1.clearedStages) !== JSON.stringify(s2.clearedStages)) diffFields.push('clearedStages');

  if (s1.settings.autoProgress !== s2.settings.autoProgress) diffFields.push('settings.autoProgress');

  if (s1.elapsedMs !== s2.elapsedMs) diffFields.push('elapsedMs');

  if (s1.rng.seed !== s2.rng.seed) diffFields.push('rng.seed');

  if (JSON.stringify(s1.log) !== JSON.stringify(s2.log)) diffFields.push('log');

  if (s1.activeActivity !== s2.activeActivity) diffFields.push('activeActivity');

  const s1StageId = s1.combat?.stageId ?? null;
  const s2StageId = s2.combat?.stageId ?? null;
  if (s1StageId !== s2StageId) diffFields.push('stageId');

  if (diffFields.length === 0) {
    console.log('Round trip: OK');
  } else {
    console.log(`Round trip: FAILED - differing fields: ${diffFields.join(', ')}`);
  }
}

// ============================================================================
// SKILL TREE (fresh state)
// ============================================================================

console.log('\n=== Skill Tree ===');
const skillState = createInitialState(seed, defaultConfig);

const totalNodes = defaultConfig.content.skillNodes.size;
let totalCost = 0;
for (const node of defaultConfig.content.skillNodes.values()) {
  totalCost += node.cost;
}
console.log(`Total nodes: ${totalNodes}`);
console.log(`Total cost of all nodes: ${totalCost}`);

// Give enough skill points and purchase a fixed path
let skillTreeState = { ...skillState, character: { ...skillState.character, skillPoints: totalCost } };

const statsBefore = deriveStats(skillTreeState, defaultConfig);
console.log('\n=== Stats Before Purchases ===');
console.log(`Max HP: ${statsBefore.maxHp.toFixed(2)}`);
console.log(`Attack: ${statsBefore.attack.toFixed(2)}`);
console.log(`Attack Rate: ${statsBefore.attackRate.toFixed(2)}`);
console.log(`Crit Chance: ${(statsBefore.critChance * 100).toFixed(2)}%`);
console.log(`Crit Damage: ${statsBefore.critDamage.toFixed(2)}x`);

const purchasePath = [
  'center-root',
  'center-attack-1',
  'center-hp-2',
  'center-crit-1',
  'center-attack-2',
  'berserker-entry',
  'berserker-crit-damage',
  'center-hp-3',
  'paladin-entry',
  'paladin-hp-2',
];

for (const nodeId of purchasePath) {
  const node = defaultConfig.content.skillNodes.get(nodeId);
  if (!node) continue;

  const hasProficiencyReq = node.requirements.some(req => req.kind === 'proficiency');
  if (hasProficiencyReq) continue;

  skillTreeState = dispatch(skillTreeState, { type: 'purchaseNode', nodeId }, defaultConfig);
}

const statsAfter = deriveStats(skillTreeState, defaultConfig);
console.log('\n=== Stats After Purchases ===');
console.log(`Max HP: ${statsAfter.maxHp.toFixed(2)}`);
console.log(`Attack: ${statsAfter.attack.toFixed(2)}`);
console.log(`Attack Rate: ${statsAfter.attackRate.toFixed(2)}`);
console.log(`Crit Chance: ${(statsAfter.critChance * 100).toFixed(2)}%`);
console.log(`Crit Damage: ${statsAfter.critDamage.toFixed(2)}x`);
console.log(`Purchased nodes: ${skillTreeState.purchasedNodes.length}`);
console.log(`Remaining skill points: ${skillTreeState.character.skillPoints}`);

// ============================================================================
// M2-03: Stage-2 Requirement Test (fresh state)
// ============================================================================

console.log('\n=== M2-03: Stage-2 Requirement Test ===');
let testState = createInitialState(42, defaultConfig);

// Unlock stage-2 but leave proficiency at level 1
testState = { ...testState, unlockedStages: ['stage-1', 'stage-2'] };

// Attempt to start stage-2 with proficiency level 1 (should be rejected)
const rejection = canStartStage(testState, 'stage-2', defaultConfig);
if (rejection === 'ok') {
  console.log('FAILED: Stage-2 should have been rejected with proficiency level 1');
} else {
  console.log(`Stage-2 rejected (proficiency level 1): ${rejection}`);
}

// Set proficiency swordsmanship to level 3 and try again (should succeed)
testState = { ...testState, proficiency: { ...testState.proficiency, swordsmanship: { xp: 0, level: 3 } } };
const acceptance = canStartStage(testState, 'stage-2', defaultConfig);
if (acceptance === 'ok') {
  console.log('Stage-2 accepted (proficiency level 3): ok');
} else {
  console.log(`FAILED: Stage-2 should have been accepted with proficiency level 3, got: ${acceptance}`);
}

// ============================================================================
// M2-04: Proficiency and Training (each section in a fresh state)
// ============================================================================

const curve = defaultConfig.content.proficiencyCurve;

// Total proficiency XP needed for level 3 and level 10
let xpToLevel3 = 0;
for (let level = 1; level < 3; level++) {
  xpToLevel3 += Math.round(curve.baseXp * Math.pow(curve.growthFactor, level - 1));
}

let xpToLevel10 = 0;
for (let level = 1; level < curve.maxLevel; level++) {
  xpToLevel10 += Math.round(curve.baseXp * Math.pow(curve.growthFactor, level - 1));
}

console.log(`\nProficiency XP needed for level 3: ${xpToLevel3}`);
console.log(`Proficiency XP needed for level 10: ${xpToLevel10}`);

// (a) Train Swordsmanship for 60 simulated seconds
console.log('\n=== M2-04a: Train Swordsmanship for 60s ===');
let trainState = createInitialState(7, defaultConfig);
const charXpBefore = trainState.character.xp;

trainState = dispatch(trainState, { type: 'startActivity', activityId: 'training', params: { disciplineId: 'swordsmanship' } }, defaultConfig);
trainState = advanceSeconds(trainState, 60, defaultConfig);

const profAfter = trainState.proficiency.swordsmanship;
const charXpAfter = trainState.character.xp;
console.log(`Swordsmanship: level ${profAfter.level}, xp ${profAfter.xp.toFixed(2)}`);
console.log(`Character XP gained: ${(charXpAfter - charXpBefore).toFixed(2)}`);

// (b) Fight for 60 simulated seconds, print Swordsmanship xp gained from combat
console.log('\n=== M2-04b: Fight for 60s (combat Swordsmanship trickle) ===');
let fightState = createInitialState(99, defaultConfig);
const fightProfBefore = fightState.proficiency.swordsmanship;

fightState = dispatch(fightState, { type: 'startActivity', activityId: 'combat', params: { stageId: defaultConfig.content.startingStageId } }, defaultConfig);
fightState = advanceSeconds(fightState, 60, defaultConfig);

const fightProfAfter = fightState.proficiency.swordsmanship;
console.log(`Swordsmanship xp gained from combat: ${(fightProfAfter.xp - fightProfBefore.xp).toFixed(2)}`);
console.log(`Swordsmanship level: ${fightProfAfter.level}, xp: ${fightProfAfter.xp.toFixed(2)}`);

// (c) Train Swordsmanship until level 3, then start stage-2
console.log('\n=== M2-04c: Train Swordsmanship to level 3, then stage-2 ===');
let trainTo3State = createInitialState(11, defaultConfig);

trainTo3State = dispatch(trainTo3State, { type: 'startActivity', activityId: 'training', params: { disciplineId: 'swordsmanship' } }, defaultConfig);

// Train in 10-second chunks until Swordsmanship reaches level 3
let trainingSeconds = 0;
while (trainTo3State.proficiency.swordsmanship.level < 3) {
  trainTo3State = advanceSeconds(trainTo3State, 10, defaultConfig);
  trainingSeconds += 10;
  if (trainingSeconds > 1000) break; // safety
}

console.log(`Time to reach Swordsmanship level 3: ${trainingSeconds.toFixed(1)} seconds`);
console.log(`Swordsmanship: level ${trainTo3State.proficiency.swordsmanship.level}, xp ${trainTo3State.proficiency.swordsmanship.xp.toFixed(2)}`);

// Unlock stage-2, then start it (requirement: Swordsmanship level 3)
trainTo3State = { ...trainTo3State, unlockedStages: [...trainTo3State.unlockedStages, 'stage-2'] };
// Start stage-2 (requirement: Swordsmanship level 3)
const stage2Result = dispatch(trainTo3State, { type: 'startActivity', activityId: 'combat', params: { stageId: 'stage-2' } }, defaultConfig);
if (stage2Result.activeActivity === 'combat') {
  console.log('Stage-2 started: ok');
} else {
  console.log('FAILED: Stage-2 should have started');
}
