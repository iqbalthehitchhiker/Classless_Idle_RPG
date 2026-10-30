/**
 * Tests for requirements system (M2-03).
 */
import { describe, it, expect } from 'vitest';
import { checkRequirements } from '../../src/core/requirements.js';
import { createInitialState } from '../../src/core/engine.js';
import { defaultConfig } from '../../src/data/index.js';
import type { Requirement } from '../../src/data/schemas.js';
import type { GameState } from '../../src/core/types.js';

describe('checkRequirements', () => {
  it('returns ok for empty requirements', () => {
    const state = createInitialState(1, defaultConfig);
    const result = checkRequirements(state, [], defaultConfig);
    expect(result.ok).toBe(true);
  });

  it('passes when character level meets requirement', () => {
    const state = createInitialState(1, defaultConfig);
    const stateLevel5: GameState = {
      ...state,
      character: { ...state.character, level: 5 },
    };
    const requirements: Requirement[] = [{ kind: 'level', level: 3 }];
    const result = checkRequirements(stateLevel5, requirements, defaultConfig);
    expect(result.ok).toBe(true);
  });

  it('fails when character level is too low', () => {
    const state = createInitialState(1, defaultConfig);
    const stateLevel2: GameState = {
      ...state,
      character: { ...state.character, level: 2 },
    };
    const requirements: Requirement[] = [{ kind: 'level', level: 5 }];
    const result = checkRequirements(stateLevel2, requirements, defaultConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unmet).toHaveLength(1);
      expect(result.unmet[0].requirement).toEqual({ kind: 'level', level: 5 });
      expect(result.unmet[0].text).toContain('Character level 5');
      expect(result.unmet[0].text).toContain('you are 2');
    }
  });

  it('passes when proficiency level meets requirement', () => {
    const state = createInitialState(1, defaultConfig);
    const stateWithProficiency: GameState = {
      ...state,
      proficiency: { swordsmanship: { xp: 0, level: 5 }, fortitude: { xp: 0, level: 2 } },
    };
    const requirements: Requirement[] = [
      { kind: 'proficiency', disciplineId: 'swordsmanship', level: 3 },
    ];
    const result = checkRequirements(stateWithProficiency, requirements, defaultConfig);
    expect(result.ok).toBe(true);
  });

  it('fails when proficiency level is too low', () => {
    const state = createInitialState(1, defaultConfig);
    const stateWithProficiency: GameState = {
      ...state,
      proficiency: { swordsmanship: { xp: 0, level: 1 }, fortitude: { xp: 0, level: 0 } },
    };
    const requirements: Requirement[] = [
      { kind: 'proficiency', disciplineId: 'swordsmanship', level: 3 },
    ];
    const result = checkRequirements(stateWithProficiency, requirements, defaultConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unmet).toHaveLength(1);
      expect(result.unmet[0].requirement.kind).toBe('proficiency');
      expect(result.unmet[0].text).toContain('Swordsmanship');
      expect(result.unmet[0].text).toContain('level 3');
      expect(result.unmet[0].text).toContain('you have 1');
    }
  });

  it('passes when required node is purchased', () => {
    const state = createInitialState(1, defaultConfig);
    const stateWithNodes: GameState = {
      ...state,
      purchasedNodes: ['center-root', 'center-attack-1'],
    };
    const requirements: Requirement[] = [
      { kind: 'node', nodeId: 'center-root' },
    ];
    const result = checkRequirements(stateWithNodes, requirements, defaultConfig);
    expect(result.ok).toBe(true);
  });

  it('fails when required node is not purchased', () => {
    const state = createInitialState(1, defaultConfig);
    const requirements: Requirement[] = [
      { kind: 'node', nodeId: 'center-root' },
    ];
    const result = checkRequirements(state, requirements, defaultConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unmet).toHaveLength(1);
      expect(result.unmet[0].requirement.kind).toBe('node');
      expect(result.unmet[0].text).toContain('Needs skill:');
    }
  });

  it('passes when required stage is cleared', () => {
    const state = createInitialState(1, defaultConfig);
    const stateCleared: GameState = {
      ...state,
      clearedStages: ['stage-1'],
    };
    const requirements: Requirement[] = [
      { kind: 'stageCleared', stageId: 'stage-1' },
    ];
    const result = checkRequirements(stateCleared, requirements, defaultConfig);
    expect(result.ok).toBe(true);
  });

  it('fails when required stage is not cleared', () => {
    const state = createInitialState(1, defaultConfig);
    const requirements: Requirement[] = [
      { kind: 'stageCleared', stageId: 'stage-1' },
    ];
    const result = checkRequirements(state, requirements, defaultConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unmet).toHaveLength(1);
      expect(result.unmet[0].requirement.kind).toBe('stageCleared');
      expect(result.unmet[0].text).toContain('Clear stage:');
      expect(result.unmet[0].text).toContain('Whispering Woods');
    }
  });

  it('returns all unmet requirements when multiple fail', () => {
    const state = createInitialState(1, defaultConfig);
    const stateLevel2: GameState = {
      ...state,
      character: { ...state.character, level: 2 },
      proficiency: { swordsmanship: { xp: 0, level: 1 }, fortitude: { xp: 0, level: 0 } },
    };
    const requirements: Requirement[] = [
      { kind: 'level', level: 5 },
      { kind: 'proficiency', disciplineId: 'swordsmanship', level: 3 },
      { kind: 'node', nodeId: 'center-root' },
    ];
    const result = checkRequirements(stateLevel2, requirements, defaultConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unmet).toHaveLength(3);
      expect(result.unmet[0].text).toContain('Character level 5');
      expect(result.unmet[1].text).toContain('Swordsmanship');
      expect(result.unmet[2].text).toContain('Needs skill:');
    }
  });

  it('text includes current values for level and proficiency', () => {
    const state = createInitialState(1, defaultConfig);
    const stateLevel3: GameState = {
      ...state,
      character: { ...state.character, level: 3 },
      proficiency: { swordsmanship: { xp: 0, level: 2 }, fortitude: { xp: 0, level: 1 } },
    };
    const requirements: Requirement[] = [
      { kind: 'level', level: 10 },
      { kind: 'proficiency', disciplineId: 'fortitude', level: 5 },
    ];
    const result = checkRequirements(stateLevel3, requirements, defaultConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unmet[0].text).toContain('you are 3');
      expect(result.unmet[1].text).toContain('you have 1');
    }
  });
});
