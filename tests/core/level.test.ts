import { describe, it, expect } from 'vitest';
import { awardCharacterXp, awardXp, xpToNextLevel } from '../../src/core/level.js';
import { createInitialState } from '../../src/core/engine.js';
import { deriveStatsForLevel } from '../../src/core/stats.js';
import type { CharacterState, GameState } from '../../src/core/types.js';
import { defaultConfig } from '../helpers/config.js';

describe('xpToNextLevel', () => {
  it('calculates XP threshold for starting levels per D12', () => {
    // D12: xpToNext(level) = round(baseXp * growthFactor^(level-1))
    const { baseXp, growthFactor } = defaultConfig.levelCurve;
    // level 1: round(baseXp * growthFactor^0)
    expect(xpToNextLevel(1, defaultConfig.levelCurve)).toBe(Math.round(baseXp * Math.pow(growthFactor, 0)));
    // level 2: round(baseXp * growthFactor^1)
    expect(xpToNextLevel(2, defaultConfig.levelCurve)).toBe(Math.round(baseXp * Math.pow(growthFactor, 1)));
    // level 3: round(baseXp * growthFactor^2)
    expect(xpToNextLevel(3, defaultConfig.levelCurve)).toBe(Math.round(baseXp * Math.pow(growthFactor, 2)));
    // level 4: round(baseXp * growthFactor^3)
    expect(xpToNextLevel(4, defaultConfig.levelCurve)).toBe(Math.round(baseXp * Math.pow(growthFactor, 3)));
  });

  it('normalizes levels below 1 to level 1', () => {
    const level1Threshold = xpToNextLevel(1, defaultConfig.levelCurve);
    expect(xpToNextLevel(0, defaultConfig.levelCurve)).toBe(level1Threshold);
    expect(xpToNextLevel(-5, defaultConfig.levelCurve)).toBe(level1Threshold);
  });

  it('normalizes fractional levels by flooring', () => {
    const level2Threshold = xpToNextLevel(2, defaultConfig.levelCurve);
    expect(xpToNextLevel(2.8, defaultConfig.levelCurve)).toBe(level2Threshold);
  });

  it('throws on non-finite level', () => {
    expect(() => xpToNextLevel(Number.NaN, defaultConfig.levelCurve)).toThrow(RangeError);
    expect(() => xpToNextLevel(Number.POSITIVE_INFINITY, defaultConfig.levelCurve)).toThrow(RangeError);
  });

  it('respects custom level curve configuration', () => {
    const customConfig = {
      baseXp: 100,
      growthFactor: 2.0,
      skillPointsPerLevel: 2,
    };
    expect(xpToNextLevel(1, customConfig)).toBe(100);
    expect(xpToNextLevel(2, customConfig)).toBe(200);
    expect(xpToNextLevel(3, customConfig)).toBe(400);
  });

  it('returns infinity when at or above maxLevel', () => {
    const customConfig = {
      baseXp: 50,
      growthFactor: 1.35,
      skillPointsPerLevel: 1,
      maxLevel: 3,
    };
    expect(xpToNextLevel(1, customConfig)).toBe(50);
    expect(xpToNextLevel(2, customConfig)).toBe(68);
    expect(xpToNextLevel(3, customConfig)).toBe(Number.POSITIVE_INFINITY);
    expect(xpToNextLevel(4, customConfig)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('awardCharacterXp and awardXp', () => {
  const startingMaxHp = deriveStatsForLevel(1, defaultConfig.character).maxHp;
  const baseCharacter: CharacterState = {
    level: 1,
    xp: 0,
    skillPoints: 0,
    currentHp: startingMaxHp,
  };

  it('returns unchanged character if awarded 0 XP', () => {
    const result = awardCharacterXp(baseCharacter, 0, defaultConfig.levelCurve);
    expect(result).toBe(baseCharacter);
  });

  it('throws on negative or non-finite XP', () => {
    expect(() => awardCharacterXp(baseCharacter, -1, defaultConfig.levelCurve)).toThrow(RangeError);
    expect(() => awardCharacterXp(baseCharacter, Number.NaN, defaultConfig.levelCurve)).toThrow(RangeError);
    expect(() => awardCharacterXp(baseCharacter, Number.POSITIVE_INFINITY, defaultConfig.levelCurve)).toThrow(RangeError);
  });

  it('accumulates XP without leveling up when below threshold', () => {
    const result = awardCharacterXp(baseCharacter, 30, defaultConfig.levelCurve);
    expect(result.level).toBe(1);
    expect(result.xp).toBe(30);
    expect(result.skillPoints).toBe(0);
    expect(result.currentHp).toBe(startingMaxHp);
  });

  it('levels up exactly once when meeting the threshold', () => {
    const level1Threshold = xpToNextLevel(1, defaultConfig.levelCurve);
    const result = awardCharacterXp(baseCharacter, level1Threshold, defaultConfig.levelCurve);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(0);
    expect(result.skillPoints).toBe(1);
  });

  it('levels up and carries surplus XP to the next level', () => {
    const level1Threshold = xpToNextLevel(1, defaultConfig.levelCurve);
    const surplus = 15;
    const result = awardCharacterXp(baseCharacter, level1Threshold + surplus, defaultConfig.levelCurve);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(surplus);
    expect(result.skillPoints).toBe(1);
  });

  it('accounts for existing XP progress towards a level', () => {
    const level1Threshold = xpToNextLevel(1, defaultConfig.levelCurve);
    const existingXp = 40;
    const surplus = 15;
    const partialChar: CharacterState = {
      level: 1,
      xp: existingXp,
      skillPoints: 0,
      currentHp: startingMaxHp,
    };
    // existingXp + award = level1Threshold + surplus
    const result = awardCharacterXp(partialChar, level1Threshold - existingXp + surplus, defaultConfig.levelCurve);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(surplus);
    expect(result.skillPoints).toBe(1);
  });

  describe('multi-level jumps', () => {
    it('handles exact multi-level jumps (level 1 -> 3)', () => {
      const level1to2 = xpToNextLevel(1, defaultConfig.levelCurve);
      const level2to3 = xpToNextLevel(2, defaultConfig.levelCurve);
      const totalXp = level1to2 + level2to3;
      const result = awardCharacterXp(baseCharacter, totalXp, defaultConfig.levelCurve);
      expect(result.level).toBe(3);
      expect(result.xp).toBe(0);
      expect(result.skillPoints).toBe(2);
    });

    it('handles multi-level jumps with remainder (level 1 -> 3 with remainder)', () => {
      const level1to2 = xpToNextLevel(1, defaultConfig.levelCurve);
      const level2to3 = xpToNextLevel(2, defaultConfig.levelCurve);
      const remainder = 12;
      const totalXp = level1to2 + level2to3 + remainder;
      const result = awardCharacterXp(baseCharacter, totalXp, defaultConfig.levelCurve);
      expect(result.level).toBe(3);
      expect(result.xp).toBe(remainder);
      expect(result.skillPoints).toBe(2);
    });

    it('handles 3-level jump (level 1 -> 4)', () => {
      const level1to2 = xpToNextLevel(1, defaultConfig.levelCurve);
      const level2to3 = xpToNextLevel(2, defaultConfig.levelCurve);
      const level3to4 = xpToNextLevel(3, defaultConfig.levelCurve);
      const totalXp = level1to2 + level2to3 + level3to4;
      const result = awardCharacterXp(baseCharacter, totalXp, defaultConfig.levelCurve);
      expect(result.level).toBe(4);
      expect(result.xp).toBe(0);
      expect(result.skillPoints).toBe(3);
    });

    it('handles large XP awards across many levels', () => {
      // Award 1000 XP and compute expected level/remainder
      const awardedXp = 1000;
      let remaining = awardedXp;
      let level = 1;
      while (remaining >= xpToNextLevel(level, defaultConfig.levelCurve)) {
        remaining -= xpToNextLevel(level, defaultConfig.levelCurve);
        level++;
      }
      const result = awardCharacterXp(baseCharacter, awardedXp, defaultConfig.levelCurve);
      expect(result.level).toBe(level);
      expect(result.xp).toBe(remaining);
      expect(result.skillPoints).toBe(level - 1);
    });
  });

  describe('configuration overrides', () => {
    it('awards custom skill points per level', () => {
      const config = {
        baseXp: 50,
        growthFactor: 1.35,
        skillPointsPerLevel: 3,
      };
      const result = awardCharacterXp(baseCharacter, 118, config);
      expect(result.level).toBe(3);
      expect(result.skillPoints).toBe(6);
    });

    it('stops leveling at maxLevel', () => {
      const config = {
        baseXp: 50,
        growthFactor: 1.35,
        skillPointsPerLevel: 1,
        maxLevel: 2,
      };
      // Awarding 1000 XP only advances to maxLevel (2)
      const result = awardCharacterXp(baseCharacter, 1000, config);
      expect(result.level).toBe(2);
      expect(result.skillPoints).toBe(1);
    });
  });

  describe('immutability and pure function guarantees', () => {
    it('does not mutate input CharacterState', () => {
      const input: CharacterState = {
        level: 1,
        xp: 10,
        skillPoints: 0,
        currentHp: startingMaxHp,
      };
      const snapshot = JSON.stringify(input);
      awardCharacterXp(input, 150, defaultConfig.levelCurve);
      expect(JSON.stringify(input)).toBe(snapshot);
    });

    it('awards XP to GameState and returns a new GameState', () => {
      const state: GameState = createInitialState(123, defaultConfig);
      const snapshot = JSON.stringify(state);

      // Award enough XP to reach level 3 with 2 XP remainder
      const level1to2 = xpToNextLevel(1, defaultConfig.levelCurve);
      const level2to3 = xpToNextLevel(2, defaultConfig.levelCurve);
      const remainder = 2;
      const awardedXp = level1to2 + level2to3 + remainder;
      const nextState = awardXp(state, awardedXp, defaultConfig.levelCurve);

      // Input state is not mutated
      expect(JSON.stringify(state)).toBe(snapshot);

      // Character was updated
      expect(nextState.character.level).toBe(3);
      expect(nextState.character.xp).toBe(remainder);
      expect(nextState.character.skillPoints).toBe(2);

      // Non-character fields remain preserved
      expect(nextState.rng).toBe(state.rng);
      expect(nextState.combat).toBe(state.combat);
      expect(nextState.activeActivity).toBe(state.activeActivity);
      expect(nextState.unlockedStages).toBe(state.unlockedStages);
      expect(nextState.remainderMs).toBe(state.remainderMs);
      expect(nextState.savedAt).toBe(state.savedAt);
    });

    it('returns same GameState reference if 0 XP awarded', () => {
      const state: GameState = createInitialState(123, defaultConfig);
      const nextState = awardXp(state, 0, defaultConfig.levelCurve);
      expect(nextState).toBe(state);
    });
  });
});
