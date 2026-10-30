/**
 * Pure proficiency rule (M2-04).
 *
 * Awards proficiency XP to a discipline, resolves level-ups via the content
 * proficiency curve, carries surplus across multiple levels, caps at maxLevel,
 * and appends a log entry per level gained.
 */

import type { GameConfig, GameState } from './types.js';
import type { ProficiencyCurve } from '../data/schemas.js';
import { appendLog } from './log.js';
import { add, sub, mul, pow, round } from './num.js';

/**
 * XP required to advance from `level` to `level + 1`.
 * Formula: round(baseXp * growthFactor^(level - 1))
 */
function xpToNextProficiencyLevel(level: number, curve: ProficiencyCurve): number {
  const levelsAboveBase = sub(level, 1);
  const factor = pow(curve.growthFactor, levelsAboveBase);
  return round(mul(curve.baseXp, factor));
}

/**
 * Award proficiency XP to a discipline and resolve level-ups.
 * Returns the input state unchanged for unknown discipline ids.
 * Pure function: never mutates the input state.
 */
export function awardProficiency(
  state: GameState,
  disciplineId: string,
  amount: number,
  config: GameConfig,
): GameState {
  if (!config.content.disciplines.has(disciplineId)) {
    return state;
  }

  const discipline = config.content.disciplines.get(disciplineId)!;
  const curve = config.content.proficiencyCurve;
  const current = state.proficiency[disciplineId];

  if (!current) {
    return state;
  }

  let newXp = add(current.xp, amount);
  let newLevel = current.level;

  // Level-up loop: carry surplus across multiple levels
  while (newLevel < curve.maxLevel) {
    const needed = xpToNextProficiencyLevel(newLevel, curve);
    if (newXp < needed) {
      break;
    }
    newXp = sub(newXp, needed);
    newLevel = add(newLevel, 1);
  }

  // Cap at maxLevel: xp stops accumulating at the cap
  if (newLevel >= curve.maxLevel) {
    newXp = 0;
  }

  const updatedProficiency: Record<string, { xp: number; level: number }> = {
    ...state.proficiency,
    [disciplineId]: { xp: newXp, level: newLevel },
  };

  let nextState: GameState = {
    ...state,
    proficiency: updatedProficiency,
  };

  // Append one log entry per level gained
  let loggedLevel = current.level;
  while (loggedLevel < newLevel) {
    loggedLevel = add(loggedLevel, 1);
    nextState = appendLog(nextState, {
      tMs: nextState.elapsedMs,
      type: 'skillLearned',
      detail: `Proficiency up: ${discipline.name} -> ${loggedLevel}`,
    });
  }

  return nextState;
}
