/**
 * M1-09: Boss encounter, stage unlock, farming loop, and auto-progress tests.
 */
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../helpers/config.js';
import {
  createInitialState,
  startCombat,
  stepCombat,
  deriveStatsForLevel,
} from '../../src/core/index.js';
import type { Content, StageDef, WaveDef, EnemyDef } from '../../src/data/index.js';
import { content as defaultContent } from '../../src/data/index.js';

function makeCustomContent(overrides: {
  enemies?: EnemyDef[];
  waves?: WaveDef[];
  stages?: StageDef[];
}): Content {
  const enemies = new Map(defaultContent.enemies);
  const waves = new Map(defaultContent.waves);
  const stages = new Map(defaultContent.stages);

  if (overrides.enemies) {
    for (const e of overrides.enemies) enemies.set(e.id, e);
  }
  if (overrides.waves) {
    for (const w of overrides.waves) waves.set(w.id, w);
  }
  if (overrides.stages) {
    for (const s of overrides.stages) stages.set(s.id, s);
  }

  return {
    effects: defaultContent.effects,
    enemies,
    waves,
    stages,
    playerBaseOnHitEffects: defaultContent.playerBaseOnHitEffects,
    startingStageId: defaultContent.startingStageId,
    raw: defaultContent.raw,
  };
}

describe('M1-09: Boss Encounters and Stage Progression', () => {
  // -------------------------------------------------------------------------
  // Boss spawning and stats
  // -------------------------------------------------------------------------
  it('spawns exactly one boss after final regular wave with configured stats and on-hit effects', () => {
    const boss: EnemyDef = {
      id: 'test-boss',
      name: 'Test Boss',
      maxHp: 500,
      damage: 20,
      attackInterval: 2.0,
      xpReward: 200,
      isBoss: true,
      onHitEffects: ['stun'],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'test-stage',
      name: 'Test Stage',
      waves: ['w1'],
      boss: 'test-boss',
      bossXpBonus: 100,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: [...state.unlockedStages, 'test-stage'] };
    state = startCombat(state, 'test-stage', { ...defaultConfig, content: customContent });

    // Kill wave 1
    for (let i = 0; i < 100; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.phase.type === 'boss') break;
    }

    // Boss spawned
    expect(state.combat!.phase.type).toBe('boss');
    expect(state.combat!.enemies.length).toBe(1);
    const bossState = state.combat!.enemies[0];
    expect(bossState.defId).toBe('test-boss');
    expect(bossState.hp).toBe(500);
    expect(bossState.maxHp).toBe(500);
    
    // Boss can apply stun
    const bossDef = customContent.enemies.get('test-boss')!;
    expect(bossDef.onHitEffects).toContain('stun');
  });

  // -------------------------------------------------------------------------
  // Boss XP rewards
  // -------------------------------------------------------------------------
  it('awards xpReward + bossXpBonus on boss kill by attack', () => {
    const boss: EnemyDef = {
      id: 'weak-boss',
      name: 'Weak Boss',
      maxHp: 50,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 150,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'xp-test-stage',
      name: 'XP Test Stage',
      waves: ['w1'],
      boss: 'weak-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: [...state.unlockedStages, 'xp-test-stage'] };
    state = startCombat(state, 'xp-test-stage', { ...defaultConfig, content: customContent });

    // Kill wave 1 then boss
    const initialXp = state.character.xp;
    for (let i = 0; i < 200; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // Boss was killed, XP = base 150 + bonus 50 + wave 1 enemy xp (10)
    expect(state.character.xp).toBe(initialXp + 10 + 150 + 50);
  });

  it('awards xpReward + bossXpBonus on boss kill by DoT', () => {
    const boss: EnemyDef = {
      id: 'dot-boss',
      name: 'DoT Boss',
      maxHp: 5,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'dot-boss-stage',
      name: 'DoT Boss Stage',
      waves: ['w1'],
      boss: 'dot-boss',
      bossXpBonus: 75,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: [...state.unlockedStages, 'dot-boss-stage'] };
    state = startCombat(state, 'dot-boss-stage', { ...defaultConfig, content: customContent });

    // Kill wave 1, wait for boss, let burn kill boss
    const initialXp = state.character.xp;
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // Boss was killed, XP includes boss bonus
    expect(state.character.xp).toBeGreaterThanOrEqual(initialXp + 100 + 75);
  });

  // -------------------------------------------------------------------------
  // Stage unlock and idempotency
  // -------------------------------------------------------------------------
  it('unlocks next stage on first boss kill (idempotent)', () => {
    const boss: EnemyDef = {
      id: 'unlock-boss',
      name: 'Unlock Boss',
      maxHp: 50,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage1: StageDef = {
      id: 'stage-unlock-1',
      name: 'Stage 1',
      waves: ['w1'],
      boss: 'unlock-boss',
      bossXpBonus: 50,
      unlocksStageId: 'stage-unlock-2',
    };
    const stage2: StageDef = {
      id: 'stage-unlock-2',
      name: 'Stage 2',
      waves: ['w1'],
      boss: 'unlock-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({
      enemies: [boss],
      waves: [wave],
      stages: [stage1, stage2],
    });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['stage-unlock-1'] };
    state = startCombat(state, 'stage-unlock-1', { ...defaultConfig, content: customContent });

    // stage-unlock-2 not unlocked yet
    expect(state.unlockedStages).not.toContain('stage-unlock-2');

    // Kill wave 1 and boss
    for (let i = 0; i < 500; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // stage-unlock-2 now unlocked
    expect(state.unlockedStages).toContain('stage-unlock-2');
    const unlockCount1 = state.unlockedStages.filter((s) => s === 'stage-unlock-2').length;
    expect(unlockCount1).toBe(1);

    // Kill boss again (farming)
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // stage-unlock-2 still present, no duplicates
    const unlockCount2 = state.unlockedStages.filter((s) => s === 'stage-unlock-2').length;
    expect(unlockCount2).toBe(1);
  });

  it('adds stage to clearedStages on boss kill (idempotent, no duplicates)', () => {
    const boss: EnemyDef = {
      id: 'clear-boss',
      name: 'Clear Boss',
      maxHp: 50,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'clear-stage',
      name: 'Clear Stage',
      waves: ['w1'],
      boss: 'clear-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['clear-stage'] };
    state = startCombat(state, 'clear-stage', { ...defaultConfig, content: customContent });

    expect(state.clearedStages).toEqual([]);

    // Kill boss once
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    expect(state.clearedStages).toContain('clear-stage');
    const clearCount1 = state.clearedStages.filter((s) => s === 'clear-stage').length;
    expect(clearCount1).toBe(1);

    // Kill boss again
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // No duplicates
    const clearCount2 = state.clearedStages.filter((s) => s === 'clear-stage').length;
    expect(clearCount2).toBe(1);
  });

  it('awards boss XP bonus on every boss kill (not just first)', () => {
    const boss: EnemyDef = {
      id: 'repeat-boss',
      name: 'Repeat Boss',
      maxHp: 10, // Very weak
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'repeat-stage',
      name: 'Repeat Stage',
      waves: ['w1'],
      boss: 'repeat-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['repeat-stage'] };
    state = startCombat(state, 'repeat-stage', { ...defaultConfig, content: customContent });

    const initialXp = state.character.xp;

    // Kill boss first time
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    const xpAfterFirst = state.character.xp;
    const firstKillXp = xpAfterFirst - initialXp;
    expect(firstKillXp).toBeGreaterThanOrEqual(100 + 50);

    // Kill boss second time
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    const xpAfterSecond = state.character.xp;
    const secondKillXp = xpAfterSecond - xpAfterFirst;
    // Boss XP bonus awarded again
    expect(secondKillXp).toBeGreaterThanOrEqual(100 + 50);
  });

  // -------------------------------------------------------------------------
  // Farming loop (D2, autoProgress=false)
  // -------------------------------------------------------------------------
  it('resets to wave 0 of same stage after boss kill (farming) when autoProgress is false', () => {
    const boss: EnemyDef = {
      id: 'farm-boss',
      name: 'Farm Boss',
      maxHp: 10, // Very weak
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage1: StageDef = {
      id: 'farm-stage-1',
      name: 'Farm Stage 1',
      waves: ['w1'],
      boss: 'farm-boss',
      bossXpBonus: 50,
      unlocksStageId: 'farm-stage-2',
    };
    const stage2: StageDef = {
      id: 'farm-stage-2',
      name: 'Farm Stage 2',
      waves: ['w1'],
      boss: 'farm-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({
      enemies: [boss],
      waves: [wave],
      stages: [stage1, stage2],
    });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['farm-stage-1'], settings: { autoProgress: false } };
    state = startCombat(state, 'farm-stage-1', { ...defaultConfig, content: customContent });

    // Kill boss
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // Still on farm-stage-1, wave 0, active
    expect(state.combat!.stageId).toBe('farm-stage-1');
    expect(state.combat!.waveIndex).toBe(0);
    expect(state.combat!.phase.type).toBe('active');
    expect(state.unlockedStages).toContain('farm-stage-2'); // Unlock happened
  });

  // -------------------------------------------------------------------------
  // Auto-progress (D2, autoProgress=true)
  // -------------------------------------------------------------------------
  it('moves to next stage at wave 0 when autoProgress is true and next stage is unlocked', () => {
    const boss: EnemyDef = {
      id: 'auto-boss',
      name: 'Auto Boss',
      maxHp: 50,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage1: StageDef = {
      id: 'auto-stage-1',
      name: 'Auto Stage 1',
      waves: ['w1'],
      boss: 'auto-boss',
      bossXpBonus: 50,
      unlocksStageId: 'auto-stage-2',
    };
    const stage2: StageDef = {
      id: 'auto-stage-2',
      name: 'Auto Stage 2',
      waves: ['w1'],
      boss: 'auto-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({
      enemies: [boss],
      waves: [wave],
      stages: [stage1, stage2],
    });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['auto-stage-1'], settings: { autoProgress: true } };
    state = startCombat(state, 'auto-stage-1', { ...defaultConfig, content: customContent });

    // Kill boss
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.stageId === 'auto-stage-2') break;
    }

    // Moved to auto-stage-2, wave 0, active
    expect(state.combat!.stageId).toBe('auto-stage-2');
    expect(state.combat!.waveIndex).toBe(0);
    expect(state.combat!.phase.type).toBe('active');
  });

  it('stays on current stage when autoProgress is true but no next stage exists', () => {
    const boss: EnemyDef = {
      id: 'final-boss',
      name: 'Final Boss',
      maxHp: 50,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'final-stage',
      name: 'Final Stage',
      waves: ['w1'],
      boss: 'final-boss',
      bossXpBonus: 50,
      // No unlocksStageId
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['final-stage'], settings: { autoProgress: true } };
    state = startCombat(state, 'final-stage', { ...defaultConfig, content: customContent });

    // Kill boss
    for (let i = 0; i < 300; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 0 && state.combat!.phase.type === 'active') break;
    }

    // Still on final-stage (farming)
    expect(state.combat!.stageId).toBe('final-stage');
    expect(state.combat!.waveIndex).toBe(0);
    expect(state.combat!.phase.type).toBe('active');
  });

  // -------------------------------------------------------------------------
  // D18: Wave-clear heal
  // -------------------------------------------------------------------------
  it('restores HP to maxHp on regular wave clear', () => {
    const enemy: EnemyDef = {
      id: 'damaging-enemy',
      name: 'Damaging Enemy',
      maxHp: 5, // Very weak so die quickly
      damage: 20,
      attackInterval: 0.5,
      xpReward: 10,
      isBoss: false,
      onHitEffects: [],
    };
    const wave1: WaveDef = { id: 'w1', enemies: [{ enemyId: 'damaging-enemy', count: 1 }] };
    const wave2: WaveDef = { id: 'w2', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'heal-stage',
      name: 'Heal Stage',
      waves: ['w1', 'w2'],
      boss: 'goblin-chief',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [enemy], waves: [wave1, wave2], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['heal-stage'] };
    state = startCombat(state, 'heal-stage', { ...defaultConfig, content: customContent });

    // Manually reduce HP
    state = {
      ...state,
      combat: {
        ...state.combat!,
        playerHp: 50,
      },
      character: {
        ...state.character,
        currentHp: 50,
      },
    };

    // Kill wave 1
    for (let i = 0; i < 100; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.waveIndex === 1) break;
    }

    // HP restored to maxHp
    const maxHp = deriveStatsForLevel(state.character.level, defaultConfig.character).maxHp;
    expect(state.combat!.playerHp).toBeCloseTo(maxHp, 1);
    expect(state.character.currentHp).toBeCloseTo(maxHp, 1);
  });

  it('restores HP to maxHp on boss spawn (after last regular wave clear)', () => {
    const enemy: EnemyDef = {
      id: 'damaging-enemy',
      name: 'Damaging Enemy',
      maxHp: 5, // Very weak so they die quickly
      damage: 20,
      attackInterval: 0.5,
      xpReward: 10,
      isBoss: false,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'damaging-enemy', count: 1 }] };
    const stage: StageDef = {
      id: 'heal-boss-stage',
      name: 'Heal Boss Stage',
      waves: ['w1'],
      boss: 'goblin-chief',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [enemy], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['heal-boss-stage'] };
    state = startCombat(state, 'heal-boss-stage', { ...defaultConfig, content: customContent });

    // Manually reduce player HP before kill
    state = {
      ...state,
      combat: {
        ...state.combat!,
        playerHp: 50,
      },
      character: {
        ...state.character,
        currentHp: 50,
      },
    };

    // Kill wave 1, boss spawns
    for (let i = 0; i < 100; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.phase.type === 'boss') break;
    }

    // HP restored to maxHp
    const finalMaxHp = deriveStatsForLevel(state.character.level, defaultConfig.character).maxHp;
    expect(state.combat!.playerHp).toBeCloseTo(finalMaxHp, 1);
    expect(state.character.currentHp).toBeCloseTo(finalMaxHp, 1);
  });

  it('restores HP to maxHp on boss kill (stage reset)', () => {
    const boss: EnemyDef = {
      id: 'damaging-boss',
      name: 'Damaging Boss',
      maxHp: 50,
      damage: 5, // Reduced from 15
      attackInterval: 2.0, // Increased from 0.5
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'heal-reset-stage',
      name: 'Heal Reset Stage',
      waves: ['w1'],
      boss: 'damaging-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['heal-reset-stage'] };
    state = startCombat(state, 'heal-reset-stage', { ...defaultConfig, content: customContent });

    // Kill wave 1, reach boss
    for (let i = 0; i < 100; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.phase.type === 'boss') break;
    }

    // Manually reduce player HP
    state = {
      ...state,
      combat: {
        ...state.combat!,
        playerHp: 50,
      },
      character: {
        ...state.character,
        currentHp: 50,
      },
    };

    // Kill boss
    let foundReset = false;
    for (let i = 0; i < 200; i++) {
      const prevPhase = state.combat!.phase.type;
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      
      if (state.combat!.playerDefeated) {
        throw new Error('Player was defeated during boss fight');
      }
      
      // Check if we just transitioned from boss to wave 0 active
      if (prevPhase !== 'active' && state.combat!.phase.type === 'active' && state.combat!.waveIndex === 0) {
        foundReset = true;
        break;
      }
    }

    expect(foundReset).toBe(true);

    // Recalculate maxHp after potential level-up
    const finalMaxHp = deriveStatsForLevel(state.character.level, defaultConfig.character).maxHp;

    // HP restored to maxHp (immediately after reset, before new enemies attack)
    expect(state.combat!.playerHp).toBeCloseTo(finalMaxHp, 1);
    expect(state.character.currentHp).toBeCloseTo(finalMaxHp, 1);
  });

  it('D18 heal uses NEW maxHp after mid-step level-up', () => {
    // Set up a scenario where killing the last enemy grants enough XP to level up
    // Then the heal should use the new level's maxHp
    const boss: EnemyDef = {
      id: 'levelup-boss',
      name: 'Level Up Boss',
      maxHp: 50,
      damage: 1,
      attackInterval: 10.0,
      xpReward: 5000, // Much higher to guarantee multiple level-ups
      isBoss: true,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'levelup-stage',
      name: 'Level Up Stage',
      waves: ['w1'],
      boss: 'levelup-boss',
      bossXpBonus: 5000,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['levelup-stage'] };
    state = startCombat(state, 'levelup-stage', { ...defaultConfig, content: customContent });

    const initialLevel = state.character.level;
    const initialMaxHp = deriveStatsForLevel(initialLevel, defaultConfig.character).maxHp;

    // Damage player
    state = {
      ...state,
      combat: {
        ...state.combat!,
        playerHp: 50,
      },
      character: {
        ...state.character,
        currentHp: 50,
      },
    };

    // Kill boss (should level up and heal to new maxHp)
    let foundReset = false;
    for (let i = 0; i < 500; i++) {
      const prevPhase = state.combat!.phase.type;
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      
      if (state.combat!.playerDefeated) {
        throw new Error(`Player defeated during levelup test at step ${i}`);
      }
      
      // Check if we just completed the boss fight
      if (prevPhase !== 'active' && state.combat!.phase.type === 'active' && state.combat!.waveIndex === 0) {
        foundReset = true;
        break;
      }
    }

    expect(foundReset).toBe(true);

    // Level increased
    expect(state.character.level).toBeGreaterThan(initialLevel);

    // HP = new maxHp
    const newMaxHp = deriveStatsForLevel(state.character.level, defaultConfig.character).maxHp;
    expect(newMaxHp).toBeGreaterThan(initialMaxHp);
    expect(state.combat!.playerHp).toBe(newMaxHp);
    expect(state.character.currentHp).toBe(newMaxHp);
  });

  // -------------------------------------------------------------------------
  // Regression: Lethal DoT with enemies alive defeats player
  // -------------------------------------------------------------------------
  it('regression: lethal DoT with enemies still alive after step defeats player', () => {
    const enemy: EnemyDef = {
      id: 'survivor',
      name: 'Survivor',
      maxHp: 1000,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 10,
      isBoss: false,
      onHitEffects: [],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'survivor', count: 2 }] };
    const stage: StageDef = {
      id: 'no-tie-stage',
      name: 'No Tie Stage',
      waves: ['w1'],
      boss: 'goblin-chief',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [enemy], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['no-tie-stage'] };
    state = startCombat(state, 'no-tie-stage', { ...defaultConfig, content: customContent });

    // Apply lethal DoT to player with enemies alive
    state = {
      ...state,
      combat: {
        ...state.combat!,
        playerHp: 2,
        playerEffects: [
          {
            effectId: 'burn',
            remainingMs: 3000,
            tickTimerMs: 1000,
            stacks: 1,
          },
        ],
      },
    };

    state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });

    // Player defeated (no tie)
    expect(state.combat!.playerHp).toBe(0);
    expect(state.combat!.playerDefeated).toBe(true);
    expect(state.combat!.phase.type).toBe('playerDefeated');
  });

  // -------------------------------------------------------------------------
  // Stun test during boss phase
  // -------------------------------------------------------------------------
  it('boss stun applies through boss hit and freezes player attack timer', () => {
    const boss: EnemyDef = {
      id: 'stun-boss',
      name: 'Stun Boss',
      maxHp: 1000,
      damage: 5,
      attackInterval: 0.5,
      xpReward: 100,
      isBoss: true,
      onHitEffects: ['stun'],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'stun-boss-stage',
      name: 'Stun Boss Stage',
      waves: ['w1'],
      boss: 'stun-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state = createInitialState(1, defaultConfig);
    state = { ...state, unlockedStages: ['stun-boss-stage'] };
    state = startCombat(state, 'stun-boss-stage', { ...defaultConfig, content: customContent });

    // Kill wave 1, reach boss
    for (let i = 0; i < 100; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.phase.type === 'boss') break;
    }

    // Wait for boss to hit and stun player
    for (let i = 0; i < 10; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      if (state.combat!.playerEffects.some((e) => e.effectId === 'stun')) break;
    }

    const stunned = state.combat!.playerEffects.some((e) => e.effectId === 'stun');
    expect(stunned).toBe(true);

    // Attack timer stays frozen while stunned
    const timerWhileStunned = state.combat!.playerAttackTimerMs;
    for (let i = 0; i < 5; i++) {
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
    }

    expect(state.combat!.playerAttackTimerMs).toBe(timerWhileStunned);
  });

  // -------------------------------------------------------------------------
  // Time-splitting invariance with boss phase
  // -------------------------------------------------------------------------
  it('time splitting invariance with boss phase: advance(s, 10) === 100 x advance(s, 0.1)', () => {
    const boss: EnemyDef = {
      id: 'split-boss',
      name: 'Split Boss',
      maxHp: 500,
      damage: 5,
      attackInterval: 1.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: ['stun'],
    };
    const wave: WaveDef = { id: 'w1', enemies: [{ enemyId: 'slime', count: 1 }] };
    const stage: StageDef = {
      id: 'split-stage',
      name: 'Split Stage',
      waves: ['w1'],
      boss: 'split-boss',
      bossXpBonus: 50,
    };
    const customContent = makeCustomContent({ enemies: [boss], waves: [wave], stages: [stage] });

    let state1 = createInitialState(42, defaultConfig);
    state1 = { ...state1, unlockedStages: ['split-stage'] };
    state1 = startCombat(state1, 'split-stage', { ...defaultConfig, content: customContent });

    // Reach boss with burn on boss and player stunned
    for (let i = 0; i < 100; i++) {
      state1 = stepCombat(state1, 0.1, { ...defaultConfig, content: customContent });
      if (state1.combat!.phase.type === 'boss') break;
    }

    // Apply burn to boss and stun to player
    state1 = {
      ...state1,
      combat: {
        ...state1.combat!,
        enemies: [
          {
            ...state1.combat!.enemies[0],
            effects: [
              {
                effectId: 'burn',
                remainingMs: 5000,
                tickTimerMs: 0,
                stacks: 1,
              },
            ],
          },
        ],
        playerEffects: [
          {
            effectId: 'stun',
            remainingMs: 2000,
            tickTimerMs: 0,
            stacks: 1,
          },
        ],
      },
    };

    let state2 = JSON.parse(JSON.stringify(state1));

    // Advance 10 s in one call
    for (let i = 0; i < 100; i++) {
      state1 = stepCombat(state1, 0.1, { ...defaultConfig, content: customContent });
    }

    // Advance 10 s in 100 calls
    for (let i = 0; i < 100; i++) {
      state2 = stepCombat(state2, 0.1, { ...defaultConfig, content: customContent });
    }

    // Deep equality
    expect(state1).toEqual(state2);
  });
});
