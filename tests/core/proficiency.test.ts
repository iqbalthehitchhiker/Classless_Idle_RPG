/**
 * Tests for awardProficiency (M2-04).
 */
import { describe, it, expect } from 'vitest';
import { awardProficiency } from '../../src/core/proficiency.js';
import { createInitialState } from '../../src/core/engine.js';
import { defaultConfig } from '../../src/data/index.js';
import type { GameState } from '../../src/core/types.js';

const swordsmanshipId = 'swordsmanship';

function getProficiency(state: GameState, disciplineId: string) {
  return state.proficiency[disciplineId];
}

describe('awardProficiency', () => {
  it('rejects unknown discipline without changing state', () => {
    const state = createInitialState(1, defaultConfig);
    const snapshot = JSON.stringify(state);

    const result = awardProficiency(state, 'nonexistent', 10, defaultConfig);

    expect(result).toBe(state);
    expect(JSON.stringify(result)).toBe(snapshot);
  });

  it('awards XP without leveling up when below threshold', () => {
    const state = createInitialState(1, defaultConfig);
    const result = awardProficiency(state, swordsmanshipId, 10, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(1);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(10);
  });

  it('levels up exactly once when meeting the threshold', () => {
    const state = createInitialState(1, defaultConfig);
    // Level 1 -> 2 costs round(20 * 1.3^0) = 20
    const result = awardProficiency(state, swordsmanshipId, 20, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(2);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(0);
  });

  it('carries surplus XP to the next level', () => {
    const state = createInitialState(1, defaultConfig);
    // Level 1 -> 2 costs 20, award 30 → level 2 with 10 XP carried
    const result = awardProficiency(state, swordsmanshipId, 30, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(2);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(10);
  });

  it('handles multi-level jumps', () => {
    const state = createInitialState(1, defaultConfig);
    // Level 1 -> 2 costs 20, Level 2 -> 3 costs round(20 * 1.3^1) = 26
    const totalXp = 20 + 26;
    const result = awardProficiency(state, swordsmanshipId, totalXp, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(3);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(0);
  });

  it('handles multi-level jumps with remainder', () => {
    const state = createInitialState(1, defaultConfig);
    const totalXp = 20 + 26 + 7;
    const result = awardProficiency(state, swordsmanshipId, totalXp, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(3);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(7);
  });

  it('caps at maxLevel and stops accumulating XP', () => {
    const state = createInitialState(1, defaultConfig);
    const curve = defaultConfig.content.proficiencyCurve;

    // Compute total XP needed to reach maxLevel from level 1
    let needed = 0;
    for (let level = 1; level < curve.maxLevel; level++) {
      needed += Math.round(curve.baseXp * Math.pow(curve.growthFactor, level - 1));
    }

    const result = awardProficiency(state, swordsmanshipId, needed * 2, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(curve.maxLevel);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(0);
  });

  it('does not exceed maxLevel even with massive XP award', () => {
    const state = createInitialState(1, defaultConfig);
    const curve = defaultConfig.content.proficiencyCurve;

    const result = awardProficiency(state, swordsmanshipId, 1_000_000, defaultConfig);

    expect(getProficiency(result, swordsmanshipId).level).toBe(curve.maxLevel);
    expect(getProficiency(result, swordsmanshipId).xp).toBe(0);
  });

  it('does not mutate input state', () => {
    const state = createInitialState(1, defaultConfig);
    const snapshot = JSON.stringify(state);

    awardProficiency(state, swordsmanshipId, 20, defaultConfig);

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
