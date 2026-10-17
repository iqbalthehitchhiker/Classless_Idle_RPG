/**
 * Combat Engine (M1-07 + M1-08).
 *
 * Implements automatic combat within the fixed-step advance() loop:
 * - Attack timers with remainder carry
 * - Player damage, crit rolling (via seeded RNG), target selection (first alive)
 * - Enemy attacks, damage, HP floored at 0
 * - Kills, enemy removal, XP award per kill (direct hits and DoT)
 * - Timed effects: Burn (damage-over-time) and Stun (attack-timer freezing)
 * - Stacking rules: refresh, stack, ignore
 * - Wave advancement and bossPending transition
 * - Player defeat flag (retreat rule deferred to M1-10)
 *
 * Hard rules:
 * - Pure functions, no input mutation, no Math.random(), Date.now(), or DOM.
 * - Uses deriveStats(state) for player stats and core/num.ts for arithmetic.
 * - Enemy and effect data loaded from Content, never hardcoded.
 */
import type { Content } from '../../data/index.js';
import { awardXp } from '../level.js';
import { add, clamp, div, mul, round, sub } from '../num.js';
import { nextBool } from '../rng.js';
import { deriveStats } from '../stats.js';
import type { CombatPhase, CombatState, EnemyState, GameConfig, GameState } from '../types.js';
import {
  applyEffectToInstances,
  deriveOnHitEffects,
  isStunned,
  tickEffectInstances,
} from './effects.js';

// ---------------------------------------------------------------------------
// Wave Spawner
// ---------------------------------------------------------------------------

/**
 * Instantiates fresh EnemyState objects for all enemies in a wave.
 */
export function spawnWaveEnemies(
  waveId: string,
  contentInstance: Content,
): readonly EnemyState[] {
  const wave = contentInstance.waves.get(waveId);
  if (!wave) {
    throw new Error(`spawnWaveEnemies: wave '${waveId}' not found in content`);
  }

  const enemies: EnemyState[] = [];
  for (const group of wave.enemies) {
    const def = contentInstance.enemies.get(group.enemyId);
    if (!def) {
      throw new Error(`spawnWaveEnemies: enemy '${group.enemyId}' not found in content`);
    }

    for (let i = 0; i < group.count; i++) {
      enemies.push({
        defId: def.id,
        hp: def.maxHp,
        maxHp: def.maxHp,
        attackTimerMs: 0,
        effects: [],
      });
    }
  }

  return enemies;
}

// ---------------------------------------------------------------------------
// Start Combat
// ---------------------------------------------------------------------------

/**
 * Initializes a new combat session for an unlocked stage.
 */
export function startCombat(
  state: GameState,
  stageId: string,
  config: GameConfig,
): GameState {
  if (state.activeActivity !== null && state.activeActivity !== 'combat') {
    return state;
  }
  if (!state.unlockedStages.includes(stageId)) {
    return state;
  }

  const stage = config.content.stages.get(stageId);
  if (!stage) {
    return state;
  }

  const initialEnemies = spawnWaveEnemies(stage.waves[0], config.content);
  const playerHp = state.character.currentHp;

  const combat: CombatState = {
    stageId,
    waveIndex: 0,
    enemies: initialEnemies,
    playerAttackTimerMs: 0,
    playerHp,
    playerEffects: [],
    phase: { type: 'active' },
    log: [],
  };

  return {
    ...state,
    activeActivity: 'combat',
    combat,
  };
}

// ---------------------------------------------------------------------------
// Hooks (M1-08 Effects / M1-09 Boss / M1-10 Defeat)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Wave Clear and Progression Logic (M1-09, D18, D17, D2)
// ---------------------------------------------------------------------------

/**
 * Applies D18 heal (full HP restore) and decides what happens next:
 * - next regular wave
 * - boss spawn
 * - stage completion + farming loop / auto-progress
 *
 * Returns updated state with new wave/boss spawned or stage reset.
 */
function handleWaveClear(
  state: GameState,
  waveIndex: number,
  isBossKill: boolean,
  config: GameConfig,
): GameState {
  const combat = state.combat!;
  const stage = config.content.stages.get(combat.stageId);
  if (!stage) {
    return state;
  }

  // D18: Heal player to full maxHp after XP (so level-ups count)
  const maxHp = deriveStats(state, config).maxHp;

  if (!isBossKill) {
    // Regular wave cleared
    const nextWaveIndex = add(waveIndex, 1);
    if (nextWaveIndex < stage.waves.length) {
      // Spawn next regular wave
      const nextEnemies = spawnWaveEnemies(stage.waves[nextWaveIndex], config.content);
      return {
        ...state,
        combat: {
          ...combat,
          waveIndex: nextWaveIndex,
          enemies: nextEnemies,
          playerHp: maxHp,
          phase: { type: 'active' },
        },
        character: {
          ...state.character,
          currentHp: maxHp,
        },
      };
    } else {
      // Final regular wave cleared -> spawn boss
      const bossEnemy = config.content.enemies.get(stage.boss);
      if (!bossEnemy) {
        // Missing boss definition: stay on cleared wave
        return state;
      }
      const bossEnemyState: EnemyState = {
        defId: bossEnemy.id,
        hp: bossEnemy.maxHp,
        maxHp: bossEnemy.maxHp,
        attackTimerMs: 0,
        effects: [],
      };
      return {
        ...state,
        combat: {
          ...combat,
          enemies: [bossEnemyState],
          playerHp: maxHp,
          phase: { type: 'boss' },
        },
        character: {
          ...state.character,
          currentHp: maxHp,
        },
      };
    }
  } else {
    // Boss kill: award bonus XP (D17), unlock stage (idempotent), add to clearedStages, then reset or auto-progress
    let updatedState = awardXp(state, stage.bossXpBonus, config.levelCurve);
    
    // Unlock next stage if present (idempotent)
    if (stage.unlocksStageId && !updatedState.unlockedStages.includes(stage.unlocksStageId)) {
      updatedState = {
        ...updatedState,
        unlockedStages: [...updatedState.unlockedStages, stage.unlocksStageId],
      };
    }

    // Add to clearedStages (idempotent, no duplicates)
    if (!updatedState.clearedStages.includes(combat.stageId)) {
      updatedState = {
        ...updatedState,
        clearedStages: [...updatedState.clearedStages, combat.stageId],
      };
    }

    // D18 heal after boss kill
    const maxHpAfterBossBonus = deriveStats(updatedState, config).maxHp;

    // Farming loop (D2) or auto-progress
    let nextStageId = combat.stageId;
    if (updatedState.settings.autoProgress && stage.unlocksStageId && updatedState.unlockedStages.includes(stage.unlocksStageId)) {
      nextStageId = stage.unlocksStageId;
    }

    const nextStage = config.content.stages.get(nextStageId);
    if (!nextStage) {
      // Missing stage: keep player in combat but stop
      return {
        ...updatedState,
        character: {
          ...updatedState.character,
          currentHp: maxHpAfterBossBonus,
        },
      };
    }

    // Reset to wave 0 of the target stage
    const freshEnemies = spawnWaveEnemies(nextStage.waves[0], config.content);
    return {
      ...updatedState,
      combat: {
        ...combat,
        stageId: nextStageId,
        waveIndex: 0,
        enemies: freshEnemies,
        playerHp: maxHpAfterBossBonus,
        phase: { type: 'active' },
      },
      character: {
        ...updatedState.character,
        currentHp: maxHpAfterBossBonus,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Step Combat (Called once per fixed 0.1s step)
// ---------------------------------------------------------------------------

/**
 * Advances combat by a time delta dt (seconds).
 * Pure function: never mutates input state.
 */
export function stepCombat(
  state: GameState,
  dt: number,
  config: GameConfig,
): GameState {
  if (state.activeActivity !== 'combat' || state.combat === null) {
    return state;
  }

  const combat = state.combat;
  const contentInstance = config.content;

  // Handle recovery phase (D1)
  if (combat.phase.type === 'recovering') {
    const dtMs = round(mul(dt, 1000));
    const newRemainingMs = Math.max(0, combat.phase.remainingMs - dtMs);
    
    if (newRemainingMs === 0) {
      // Recovery complete, return to active with fresh attack timers
      return {
        ...state,
        combat: {
          ...combat,
          playerAttackTimerMs: 0,
          phase: { type: 'active' },
        },
      };
    } else {
      // Still recovering
      return {
        ...state,
        combat: {
          ...combat,
          phase: { type: 'recovering', remainingMs: newRemainingMs },
        },
      };
    }
  }

  // If player HP is already 0, trigger defeat
  if (combat.playerHp <= 0) {
    return handleDefeat(state, config);
  }

  const dtMs = round(mul(dt, 1000));
  let currentState: GameState = state;
  let currentRng = state.rng;
  let currentEnemies: EnemyState[] = [...combat.enemies];
  let playerHp = combat.playerHp;
  let playerEffects = combat.playerEffects ?? [];
  let waveIndex = combat.waveIndex;
  let phase: CombatPhase = combat.phase;
  const hadEnemiesAtStart = currentEnemies.length > 0;
  let isBossPhase = phase.type === 'boss';

  // -------------------------------------------------------------------------
  // 0. Tick Active Effects (DoT & Expired Duration)
  // -------------------------------------------------------------------------
  const playerStunnedAtStart = isStunned(playerEffects, contentInstance);

  // Build working records for enemies with stunnedAtStart flag
  type EnemyWorkingRecord = EnemyState & { stunnedAtStart: boolean };

  // Enemies DoT
  const survivingEnemiesAfterDot: EnemyWorkingRecord[] = [];
  for (const enemy of currentEnemies) {
    const wasStunned = isStunned(enemy.effects, contentInstance);
    const tickResult = tickEffectInstances(enemy.effects, dt, contentInstance);
    const newHp = clamp(sub(enemy.hp, tickResult.totalDamage), 0, enemy.maxHp);

    if (newHp <= 0) {
      // Enemy killed by DoT!
      const enemyDef = contentInstance.enemies.get(enemy.defId);
      if (enemyDef) {
        currentState = awardXp(currentState, enemyDef.xpReward, config.levelCurve);
      }
      // Dead enemy removed (effects vanish with it)
    } else {
      const survivingEnemy: EnemyWorkingRecord = {
        ...enemy,
        hp: newHp,
        effects: tickResult.effects,
        stunnedAtStart: wasStunned,
      };
      survivingEnemiesAfterDot.push(survivingEnemy);
    }
  }
  let currentEnemiesWorking: EnemyWorkingRecord[] = survivingEnemiesAfterDot;

  // Player DoT
  const playerTickResult = tickEffectInstances(playerEffects, dt, contentInstance);
  playerEffects = playerTickResult.effects;
  let playerLethalDoT = false;
  if (playerTickResult.totalDamage > 0) {
    const maxHp = deriveStats(currentState, config).maxHp;
    playerHp = clamp(sub(playerHp, playerTickResult.totalDamage), 0, maxHp);

    if (playerHp <= 0) {
      // Player took lethal DoT; check for tie later
      playerLethalDoT = true;
    }
  }

  // Check wave cleared after DoT (D14 + D18)
  if (currentEnemiesWorking.length === 0 && hadEnemiesAtStart) {
    // D14: Tie - player survives
    if (playerLethalDoT) {
      playerLethalDoT = false; // Cancel defeat
    }
    
    currentState = handleWaveClear(currentState, waveIndex, isBossPhase, config);
    // The helper returns a new state with updated combat, so extract the new values
    currentEnemiesWorking = (currentState.combat!.enemies as EnemyState[]).map((e) => ({ ...e, stunnedAtStart: false }));
    waveIndex = currentState.combat!.waveIndex;
    phase = currentState.combat!.phase;
    isBossPhase = phase.type === 'boss';
    playerHp = currentState.combat!.playerHp; // D18: HP fully restored
  }

  // -------------------------------------------------------------------------
  // 1. Player Attack Cycle (if not stunned)
  // -------------------------------------------------------------------------
  let playerTimerMs = combat.playerAttackTimerMs;

  const playerStunned = playerStunnedAtStart || isStunned(playerEffects, contentInstance);

  if (!playerStunned) {
    let playerStats = deriveStats(currentState, config);
    let playerAttackIntervalMs = round(div(1000, playerStats.attackRate));
    playerTimerMs = add(playerTimerMs, dtMs);

    while (playerTimerMs >= playerAttackIntervalMs && currentEnemiesWorking.length > 0) {
      playerTimerMs = sub(playerTimerMs, playerAttackIntervalMs);

      // Derive stats from latest currentState (recalculated in case mid-step kill leveled up player, per D15)
      playerStats = deriveStats(currentState, config);
      playerAttackIntervalMs = round(div(1000, playerStats.attackRate));

      // Roll for crit using seeded RNG
      const [isCrit, nextRng] = nextBool(currentRng, playerStats.critChance);
      currentRng = nextRng;

      const damage = isCrit
        ? mul(playerStats.attack, playerStats.critDamage)
        : playerStats.attack;

      // Hits the first living enemy
      const target = currentEnemiesWorking[0];
      const newEnemyHp = clamp(sub(target.hp, damage), 0, target.maxHp);

      if (newEnemyHp <= 0) {
        // Enemy killed!
        const enemyDef = contentInstance.enemies.get(target.defId);
        if (enemyDef) {
          currentState = awardXp(currentState, enemyDef.xpReward, config.levelCurve);
        }
        // Remove dead enemy
        currentEnemiesWorking = currentEnemiesWorking.slice(1);
      } else {
        // Enemy survives hit: apply player's on-hit effects
        let updatedEffects = target.effects;
        const playerOnHit = deriveOnHitEffects(currentState, contentInstance);
        for (const effectId of playerOnHit) {
          const effectDef = contentInstance.effects.get(effectId);
          if (effectDef) {
            updatedEffects = applyEffectToInstances(updatedEffects, effectDef);
          }
        }

        const updatedTarget: EnemyWorkingRecord = {
          ...target,
          hp: newEnemyHp,
          effects: updatedEffects,
        };
        currentEnemiesWorking[0] = updatedTarget;
      }
    }

    // Check wave advancement after player attacks
    if (currentEnemiesWorking.length === 0 && hadEnemiesAtStart) {
      // D14: Tie - player survives
      if (playerLethalDoT) {
        playerLethalDoT = false; // Cancel defeat
      }
      
      currentState = handleWaveClear(currentState, waveIndex, isBossPhase, config);
      currentEnemiesWorking = (currentState.combat!.enemies as EnemyState[]).map((e) => ({ ...e, stunnedAtStart: false }));
      waveIndex = currentState.combat!.waveIndex;
      phase = currentState.combat!.phase;
      isBossPhase = phase.type === 'boss';
      playerHp = currentState.combat!.playerHp; // D18: HP fully restored
    }
  }
  // If playerStunned: playerTimerMs is NOT advanced, attacks cannot fire

  // If player took lethal DoT and no tie occurred, trigger defeat
  if (playerLethalDoT) {
    return handleDefeat(currentState, config);
  }

  // -------------------------------------------------------------------------
  // 2. Enemy Attack Cycle (if player still alive)
  // -------------------------------------------------------------------------
  if (currentEnemiesWorking.length > 0) {
    const updatedEnemies: EnemyWorkingRecord[] = [];

    for (const enemy of currentEnemiesWorking) {
      const enemyDef = contentInstance.enemies.get(enemy.defId);
      if (!enemyDef) {
        updatedEnemies.push(enemy);
        continue;
      }

      const enemyStunned = enemy.stunnedAtStart || isStunned(enemy.effects, contentInstance);
      let enemyTimerMs = enemy.attackTimerMs;

      if (!enemyStunned) {
        const enemyAttackIntervalMs = round(mul(enemyDef.attackInterval, 1000));
        enemyTimerMs = add(enemyTimerMs, dtMs);

        while (enemyTimerMs >= enemyAttackIntervalMs) {
          enemyTimerMs = sub(enemyTimerMs, enemyAttackIntervalMs);

          // Enemy damages player
          const maxHp = deriveStats(currentState, config).maxHp;
          playerHp = clamp(sub(playerHp, enemyDef.damage), 0, maxHp);

          // Apply enemy on-hit effects to player
          for (const effectId of enemyDef.onHitEffects) {
            const effectDef = contentInstance.effects.get(effectId);
            if (effectDef) {
              playerEffects = applyEffectToInstances(playerEffects, effectDef);
            }
          }

          if (playerHp <= 0) {
            // Player defeated
            return handleDefeat(currentState, config);
          }
        }
      }
      // If enemyStunned: enemyTimerMs is NOT advanced, enemy cannot attack

      updatedEnemies.push({
        ...enemy,
        attackTimerMs: enemyTimerMs,
      });
    }

    currentEnemiesWorking = updatedEnemies;
  }

  // Strip the stunnedAtStart flag to get clean EnemyState array
  const finalEnemies = currentEnemiesWorking.map(({ stunnedAtStart, ...rest }) => rest);

  // -------------------------------------------------------------------------
  // 3. Assemble Updated GameState
  // -------------------------------------------------------------------------
  const nextCombat: CombatState = {
    stageId: currentState.combat!.stageId,
    waveIndex,
    enemies: finalEnemies,
    playerAttackTimerMs: playerTimerMs,
    playerHp,
    playerEffects,
    phase,
    log: combat.log,
  };

  const resultState: GameState = {
    ...currentState,
    rng: currentRng,
    combat: nextCombat,
    character: {
      ...currentState.character,
      currentHp: playerHp,
    },
  };

  return resultState;
}

// ---------------------------------------------------------------------------
// Defeat Handler (D1)
// ---------------------------------------------------------------------------

/**
 * Handles player defeat per D1:
 * - Retreat one wave (min wave 0), or from boss to last regular wave
 * - Spawn fresh enemies for the retreat wave
 * - Full heal to derived maxHp
 * - Clear player effects
 * - Enter recovery phase for pauseSeconds
 */
function handleDefeat(state: GameState, config: GameConfig): GameState {
  const combat = state.combat;
  if (!combat) return state;

  const stage = config.content.stages.get(combat.stageId);
  if (!stage) return state;

  const defeatConfig = config.content.defeat;
  
  // Determine retreat wave
  let retreatWave: number;
  if (combat.phase.type === 'boss') {
    // Boss defeat -> retreat to last regular wave
    retreatWave = stage.waves.length - 1;
  } else {
    // Regular wave -> retreat by retreatWaves, min 0
    retreatWave = Math.max(0, combat.waveIndex - defeatConfig.retreatWaves);
  }

  // Spawn fresh enemies for the retreat wave
  const freshEnemies = spawnWaveEnemies(stage.waves[retreatWave], config.content);

  // Full heal to derived maxHp
  const maxHp = deriveStats(state, config).maxHp;

  // Enter recovery phase
  const pauseMs = round(mul(defeatConfig.pauseSeconds, 1000));

  return {
    ...state,
    combat: {
      ...combat,
      waveIndex: retreatWave,
      enemies: freshEnemies,
      playerHp: maxHp,
      playerEffects: [],
      playerAttackTimerMs: 0,
      phase: { type: 'recovering', remainingMs: pauseMs },
    },
    character: {
      ...state.character,
      currentHp: maxHp,
    },
  };
}
