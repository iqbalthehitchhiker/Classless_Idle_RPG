/**
 * Training activity (M2-04).
 *
 * Trains a single discipline, granting proficiency XP and a small character
 * XP trickle per second of training.
 */

import type { Activity } from '../activity.js';
import type { GameConfig, GameState } from '../types.js';
import { awardProficiency } from '../proficiency.js';
import { awardXp } from '../level.js';

export const trainingActivity: Activity = {
  id: 'training',

  canStart(
    _state: GameState,
    config: GameConfig,
    params: Record<string, unknown>,
  ): 'ok' | string {
    const disciplineId = params.disciplineId;
    if (typeof disciplineId !== 'string') {
      return 'missing or invalid disciplineId parameter';
    }

    if (!config.content.disciplines.has(disciplineId)) {
      return `Unknown discipline: '${disciplineId}'`;
    }

    return 'ok';
  },

  start(
    state: GameState,
    _config: GameConfig,
    params: Record<string, unknown>,
  ): GameState {
    const disciplineId = params.disciplineId as string;
    return {
      ...state,
      activeActivity: 'training',
      trainingDisciplineId: disciplineId,
    };
  },

  advance(
    state: GameState,
    dtMs: number,
    config: GameConfig,
  ): GameState {
    const disciplineId = state.trainingDisciplineId;
    if (!disciplineId || state.activeActivity !== 'training') {
      return state;
    }

    const dtSeconds = dtMs / 1000;
    const proficiencyGain = config.training.proficiencyPerSecond * dtSeconds;
    const xpGain = config.training.xpPerSecond * dtSeconds;

    let nextState = awardProficiency(state, disciplineId, proficiencyGain, config);
    nextState = awardXp(nextState, xpGain, config.levelCurve);

    return nextState;
  },

  stop(state: GameState): GameState {
    return {
      ...state,
      activeActivity: null,
      trainingDisciplineId: null,
    };
  },
};
