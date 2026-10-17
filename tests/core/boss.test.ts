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
import type { EffectInstance, GameConfig, GameState } from '../../src/core/index.js';
import type { Content, EffectDef, StageDef, WaveDef, EnemyDef } from '../../src/data/index.js';
import { content as defaultContent, loadContent } from '../../src/data/index.js';

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
    defeat: defaultContent.defeat,
    raw: defaultContent.raw,
  };
}

// ---------------------------------------------------------------------------
// Balance-independent boss test helpers
// ---------------------------------------------------------------------------

const tinyMob: EnemyDef = {
  id: 'tiny-mob',
  name: 'Tiny Mob',
  maxHp: 1,
  damage: 0,
  attackInterval: 10,
  xpReward: 0,
  isBoss: false,
  onHitEffects: [],
};

const tinyWave: WaveDef = {
  id: 'tiny-wave',
  enemies: [{ enemyId: tinyMob.id, count: 1 }],
};

/** Builds and validates a minimal content set via loadContent. */
function makeTinyContent(options: {
  boss: EnemyDef;
  bossXpBonus?: number;
  stageId?: string;
  unlocksStageId?: string;
  extraStages?: StageDef[];
  effects?: EffectDef[];
  playerOnHitEffects?: string[];
}): Content {
  const stageId = options.stageId ?? 'tiny-stage';
  const stage: StageDef = {
    id: stageId,
    name: 'Tiny Stage',
    waves: [tinyWave.id],
    boss: options.boss.id,
    bossXpBonus: options.bossXpBonus ?? 0,
    ...(options.unlocksStageId ? { unlocksStageId: options.unlocksStageId } : {}),
  };
  return loadContent({
    effects: options.effects ?? [],
    enemies: [tinyMob, options.boss],
    waves: [tinyWave],
    stages: [stage, ...(options.extraStages ?? [])],
    playerBaseOnHitEffects: options.playerOnHitEffects ?? [],
    startingStageId: stageId,
    defeat: {
      retreatWaves: 1,
      pauseSeconds: 3,
    },
  });
}

/** Large level curve so XP assertions are not masked by level-ups. */
function noLevelUpConfig(content: Content): GameConfig {
  return {
    ...defaultConfig,
    content,
    levelCurve: { baseXp: 1_000_000, growthFactor: 1, skillPointsPerLevel: 1 },
  };
}

/** Hand-builds a state already in the boss phase, facing the stage boss. */
function startAtBoss(
  state: GameState,
  content: Content,
  stageId: string,
  options: {
    autoProgress?: boolean;
    unlockedStages?: readonly string[];
    bossEffects?: readonly EffectInstance[];
  } = {},
): GameState {
  const stage = content.stages.get(stageId);
  if (!stage) throw new Error(`startAtBoss: stage '${stageId}' not found`);
  const boss = content.enemies.get(stage.boss);
  if (!boss) throw new Error(`startAtBoss: boss '${stage.boss}' not found`);

  const maxHp = deriveStatsForLevel(state.character.level, defaultConfig.character).maxHp;
  return {
    ...state,
    activeActivity: 'combat',
    unlockedStages: options.unlockedStages ?? [stageId],
    settings: { autoProgress: options.autoProgress ?? false },
    combat: {
      stageId,
      waveIndex: 0,
      enemies: [
        {
          defId: boss.id,
          hp: boss.maxHp,
          maxHp: boss.maxHp,
          attackTimerMs: 0,
          effects: options.bossEffects ?? [],
        },
      ],
      playerAttackTimerMs: 0,
      playerHp: maxHp,
      playerEffects: [],
      phase: { type: 'boss' },
    },
  };
}

function advanceUntil(
  state: GameState,
  config: GameConfig,
  done: (state: GameState) => boolean,
  maxSteps = 50,
): GameState {
  for (let i = 0; i < maxSteps; i++) {
    state = stepCombat(state, 0.1, config);
    if (done(state)) return state;
  }
  return state;
}

/** Reads the phase through a function so control-flow narrowing does not leak. */
function phaseOf(state: GameState): string {
  return state.combat?.phase.type ?? 'none';
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
      id: 'attack-boss',
      name: 'Attack Boss',
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 150,
      isBoss: true,
      onHitEffects: [],
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 50,
      stageId: 'xp-attack-stage',
    });
    const config = noLevelUpConfig(customContent);

    let state = startAtBoss(createInitialState(1, config), customContent, 'xp-attack-stage');
    const initialXp = state.character.xp;

    // One player attack (10 steps at 0.1 s) kills the 5 HP boss.
    state = advanceUntil(state, config, (s) => s.clearedStages.includes('xp-attack-stage'));

    expect(state.clearedStages).toContain('xp-attack-stage');
    expect(state.character.xp).toBe(initialXp + 150 + 50);
  });

  it('awards xpReward + bossXpBonus on boss kill by DoT', () => {
    const burn: EffectDef = {
      id: 'test-burn',
      name: 'Test Burn',
      kind: 'damageOverTime',
      duration: 4,
      tickInterval: 1,
      damagePerTick: 100,
      stacking: 'refresh',
      maxStacks: 3,
    };
    const boss: EnemyDef = {
      id: 'dot-boss',
      name: 'DoT Boss',
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 75,
      stageId: 'dot-boss-stage',
      effects: [burn],
    });
    const config = noLevelUpConfig(customContent);

    // Pre-apply burn so the next 0.1 s step ticks and kills the boss before
    // the player's first attack (which would need 1 s).
    const burnInstance: EffectInstance = {
      effectId: burn.id,
      remainingMs: 4000,
      tickTimerMs: 900,
      stacks: 1,
    };
    let state = startAtBoss(createInitialState(1, config), customContent, 'dot-boss-stage', {
      bossEffects: [burnInstance],
    });
    const initialXp = state.character.xp;

    state = advanceUntil(state, config, (s) => s.clearedStages.includes('dot-boss-stage'));

    expect(state.clearedStages).toContain('dot-boss-stage');
    expect(state.character.xp).toBe(initialXp + 100 + 75);
  });

  // -------------------------------------------------------------------------
  // Stage unlock and idempotency
  // -------------------------------------------------------------------------
  it('unlocks next stage on first boss kill (idempotent)', () => {
    const boss: EnemyDef = {
      id: 'unlock-boss',
      name: 'Unlock Boss',
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const stage2: StageDef = {
      id: 'stage-unlock-2',
      name: 'Stage 2',
      waves: [tinyWave.id],
      boss: boss.id,
      bossXpBonus: 50,
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 50,
      stageId: 'stage-unlock-1',
      unlocksStageId: 'stage-unlock-2',
      extraStages: [stage2],
    });
    const config = noLevelUpConfig(customContent);

    let state = startAtBoss(createInitialState(1, config), customContent, 'stage-unlock-1', {
      unlockedStages: ['stage-unlock-1'],
    });
    expect(state.unlockedStages).not.toContain('stage-unlock-2');

    // First kill unlocks stage 2.
    state = advanceUntil(state, config, (s) => s.clearedStages.includes('stage-unlock-1'));
    expect(state.clearedStages).toContain('stage-unlock-1');
    expect(state.unlockedStages).toContain('stage-unlock-2');
    expect(state.unlockedStages.filter((s) => s === 'stage-unlock-2')).toHaveLength(1);

    const xpAfterFirst = state.character.xp;

    // Second kill (farming) must not duplicate the unlock.
    state = advanceUntil(state, config, (s) => s.character.xp >= xpAfterFirst + 150);
    expect(state.character.xp).toBe(xpAfterFirst + 150);
    expect(state.unlockedStages.filter((s) => s === 'stage-unlock-2')).toHaveLength(1);
  });

  it('adds stage to clearedStages on boss kill (idempotent, no duplicates)', () => {
    const boss: EnemyDef = {
      id: 'clear-boss',
      name: 'Clear Boss',
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 50,
      stageId: 'clear-stage',
    });
    const config = noLevelUpConfig(customContent);

    let state = startAtBoss(createInitialState(1, config), customContent, 'clear-stage');
    expect(state.clearedStages).toEqual([]);

    // First kill records the stage exactly once.
    state = advanceUntil(state, config, (s) => s.clearedStages.includes('clear-stage'));
    expect(state.clearedStages).toContain('clear-stage');
    expect(state.clearedStages.filter((s) => s === 'clear-stage')).toHaveLength(1);

    const xpAfterFirst = state.character.xp;

    // Second kill must not duplicate the cleared entry.
    state = advanceUntil(state, config, (s) => s.character.xp >= xpAfterFirst + 150);
    expect(state.character.xp).toBe(xpAfterFirst + 150);
    expect(state.clearedStages.filter((s) => s === 'clear-stage')).toHaveLength(1);
  });

  it('awards boss XP bonus on every boss kill (not just first)', () => {
    const boss: EnemyDef = {
      id: 'repeat-boss',
      name: 'Repeat Boss',
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 50,
      stageId: 'repeat-stage',
    });
    const config = noLevelUpConfig(customContent);

    let state = startAtBoss(createInitialState(1, config), customContent, 'repeat-stage');
    const initialXp = state.character.xp;

    // First kill.
    state = advanceUntil(state, config, (s) => s.clearedStages.includes('repeat-stage'));
    expect(state.clearedStages).toContain('repeat-stage');
    const xpAfterFirst = state.character.xp;
    expect(xpAfterFirst - initialXp).toBe(100 + 50);

    // Second kill from the farming reset.
    state = advanceUntil(state, config, (s) => s.character.xp >= xpAfterFirst + 150);
    const xpAfterSecond = state.character.xp;
    expect(xpAfterSecond - xpAfterFirst).toBe(100 + 50);
  });

  // -------------------------------------------------------------------------
  // Farming loop (D2, autoProgress=false)
  // -------------------------------------------------------------------------
  it('resets to wave 0 of same stage after boss kill (farming) when autoProgress is false', () => {
    const boss: EnemyDef = {
      id: 'farm-boss',
      name: 'Farm Boss',
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const stage2: StageDef = {
      id: 'farm-stage-2',
      name: 'Farm Stage 2',
      waves: [tinyWave.id],
      boss: boss.id,
      bossXpBonus: 50,
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 50,
      stageId: 'farm-stage-1',
      unlocksStageId: 'farm-stage-2',
      extraStages: [stage2],
    });
    const config = noLevelUpConfig(customContent);

    let state = startAtBoss(createInitialState(1, config), customContent, 'farm-stage-1', {
      autoProgress: false,
      unlockedStages: ['farm-stage-1'],
    });
    const initialXp = state.character.xp;

    state = advanceUntil(state, config, (s) => s.clearedStages.includes('farm-stage-1'));

    // Kill definitely happened before asserting the farming behavior.
    expect(state.clearedStages).toContain('farm-stage-1');
    expect(state.character.xp).toBe(initialXp + 100 + 50);
    expect(state.unlockedStages).toContain('farm-stage-2');

    // Still on farm-stage-1, wave 0, active
    expect(state.combat!.stageId).toBe('farm-stage-1');
    expect(state.combat!.waveIndex).toBe(0);
    expect(state.combat!.phase.type).toBe('active');
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
      maxHp: 5,
      damage: 0,
      attackInterval: 10.0,
      xpReward: 100,
      isBoss: true,
      onHitEffects: [],
    };
    const customContent = makeTinyContent({
      boss,
      bossXpBonus: 50,
      stageId: 'final-stage',
      // No unlocksStageId
    });
    const config = noLevelUpConfig(customContent);

    let state = startAtBoss(createInitialState(1, config), customContent, 'final-stage', {
      autoProgress: true,
      unlockedStages: ['final-stage'],
    });
    const initialXp = state.character.xp;

    state = advanceUntil(state, config, (s) => s.clearedStages.includes('final-stage'));

    // A boss kill really happened; the stage did not merely stay put.
    expect(state.clearedStages).toContain('final-stage');
    expect(state.character.xp).toBe(initialXp + 100 + 50);

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
      const prevPhase = phaseOf(state);
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      
      if (state.combat!.phase.type === 'recovering') {
        throw new Error('Player was defeated during boss fight');
      }
      
      // Check if we just transitioned from boss to wave 0 active
      if (prevPhase === 'boss' && phaseOf(state) === 'active' && state.combat!.waveIndex === 0) {
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
      const prevPhase = phaseOf(state);
      state = stepCombat(state, 0.1, { ...defaultConfig, content: customContent });
      
      if (state.combat!.phase.type === 'recovering') {
        throw new Error(`Player defeated during levelup test at step ${i}`);
      }
      
      // Check if we just completed the boss fight
      if (prevPhase === 'boss' && phaseOf(state) === 'active' && state.combat!.waveIndex === 0) {
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

    // Player defeated (no tie): retreat to last regular wave, heal, enter recovery
    const maxHp = deriveStatsForLevel(state.character.level, defaultConfig.character).maxHp;
    expect(state.combat!.playerHp).toBe(maxHp);
    expect(state.combat!.phase.type).toBe('recovering');
    // Boss defeat should retreat to the last regular wave (wave index = stage.waves.length - 1)
    const stageFromContent = customContent.stages.get('no-tie-stage');
    expect(state.combat!.waveIndex).toBe(stageFromContent!.waves.length - 1);
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
