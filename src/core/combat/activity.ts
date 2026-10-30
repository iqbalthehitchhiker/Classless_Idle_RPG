/**
 * Combat Activity implementation (M1-12).
 *
 * Wraps existing startCombat / stepCombat logic as an Activity.
 */

import type { Activity } from '../activity.js';
import type { GameConfig, GameState } from '../types.js';
import { startCombat as startCombatImpl, stepCombat } from './engine.js';
import { canStartStage } from '../stats.js';
import { awardProficiency } from '../proficiency.js';

export const combatActivity: Activity = {
  id: 'combat',

  canStart(
    state: GameState,
    config: GameConfig,
    params: Record<string, unknown>,
  ): 'ok' | string {
    const stageId = params.stageId;
    if (typeof stageId !== 'string') {
      return 'missing or invalid stageId parameter';
    }

    return canStartStage(state, stageId, config);
  },

  start(
    state: GameState,
    config: GameConfig,
    params: Record<string, unknown>,
  ): GameState {
    const stageId = params.stageId as string;
    return startCombatImpl(state, stageId, config);
  },

  advance(
    state: GameState,
    dtMs: number,
    config: GameConfig,
  ): GameState {
    const dtSeconds = dtMs / 1000;

    // D31: combat trickle — Swordsmanship proficiency while combat is active
    // (phase active or boss, not recovering). Fortitude comes only from training.
    let stateWithProficiency = state;
    if (
      state.combat !== null
      && (state.combat.phase.type === 'active' || state.combat.phase.type === 'boss')
    ) {
      const combatGain = config.training.combatProficiencyFraction
        * config.training.proficiencyPerSecond
        * dtSeconds;
      stateWithProficiency = awardProficiency(state, 'swordsmanship', combatGain, config);
    }

    return stepCombat(stateWithProficiency, dtSeconds, config);
  },

  stop(state: GameState): GameState {
    // Stop combat: clear activeActivity and combat state
    // Preserve XP, level, unlocks, clearedStages, settings, log, and currentHp
    return {
      ...state,
      activeActivity: null,
      combat: null,
    };
  },
};
