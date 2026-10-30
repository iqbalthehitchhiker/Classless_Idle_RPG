/**
 * Save v2 migration + validation tests (M2-05).
 *
 * Pure functions only: deserialize/migrate are exercised directly, never
 * localStorage.
 */
import { describe, it, expect } from 'vitest';
import { migrate } from '../../src/persistence/schema.js';
import { deserialize, serialize } from '../../src/persistence/storage.js';
import { createInitialState, dispatch } from '../../src/core/index.js';
import { defaultConfig } from '../../src/data/index.js';
import type { SaveFile } from '../../src/persistence/schema.js';

const disciplines = [...defaultConfig.content.disciplines.values()];

function defaultProficiency(): SaveFile['state']['proficiency'] {
  const proficiency: Record<string, { xp: number; level: number }> = {};
  for (const discipline of disciplines) {
    proficiency[discipline.id] = { xp: 0, level: 1 };
  }
  return proficiency;
}

function validV2File(stateOverrides: Partial<SaveFile['state']> = {}): string {
  const state: SaveFile['state'] = {
    character: { level: 3, xp: 12, skillPoints: 2, currentHp: 90 },
    unlockedStages: ['stage-1'],
    clearedStages: [],
    settings: { autoProgress: false },
    elapsedMs: 42000,
    rng: { seed: 7 },
    log: [],
    purchasedNodes: [],
    proficiency: defaultProficiency(),
    activeActivity: null,
    activityParams: null,
    ...stateOverrides,
  };
  return JSON.stringify({ version: 2, savedAt: 1000, state });
}

describe('Save v2 (M2-05)', () => {
  it('migrates a literal v1 save to v2 with default proficiency', () => {
    const v1Save = {
      version: 1,
      savedAt: 500,
      state: {
        character: { level: 3, xp: 10, skillPoints: 2, currentHp: 50 },
        unlockedStages: ['stage-1'],
        clearedStages: [],
        settings: { autoProgress: false },
        elapsedMs: 42000,
        rng: { seed: 7 },
        log: [],
        activeActivity: 'combat',
        stageId: 'stage-1',
      },
    } as unknown;

    const migrated = migrate(v1Save, defaultConfig);

    expect(migrated.version).toBe(2);
    expect(migrated.savedAt).toBe(500);
    expect(migrated.state.character).toEqual({
      level: 3,
      xp: 10,
      skillPoints: 2,
      currentHp: 50,
    });
    expect(migrated.state.purchasedNodes).toEqual([]);
    expect(migrated.state.proficiency).toEqual(defaultProficiency());
    expect(migrated.state.activeActivity).toBe('combat');
    expect(migrated.state.activityParams).toEqual({ stageId: 'stage-1' });
  });

  it('round trips purchased nodes and non-default proficiency', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    state = {
      ...state,
      proficiency: {
        ...state.proficiency,
        swordsmanship: { xp: 30, level: 2 },
      },
    };

    const roundTrip = deserialize(serialize(state), defaultConfig);
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) throw new Error(roundTrip.error);

    const restored = roundTrip.state;
    expect(restored.purchasedNodes).toEqual(['center-root']);
    expect(restored.proficiency.swordsmanship).toEqual({ xp: 30, level: 2 });
    expect(restored.proficiency.fortitude).toEqual({ xp: 0, level: 1 });
    expect(restored.character.skillPoints).toBe(9);
    expect(restored.activeActivity).toBe(null);
  });

  it('rejects a purchased node id that does not exist in content', () => {
    const result = deserialize(
      validV2File({ purchasedNodes: ['no-such-node'] }),
      defaultConfig,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("purchasedNodes references nonexistent node 'no-such-node'");
    }
  });

  it('rejects a purchased node whose prerequisite is not owned', () => {
    // center-attack-1 requires center-root
    const result = deserialize(
      validV2File({ purchasedNodes: ['center-attack-1'] }),
      defaultConfig,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "purchased node 'center-attack-1' requires unowned prerequisite 'center-root'",
      );
    }
  });

  it('rejects a proficiency level above maxLevel', () => {
    const maxLevel = defaultConfig.content.proficiencyCurve.maxLevel;
    const result = deserialize(
      validV2File({
        proficiency: {
          ...defaultProficiency(),
          swordsmanship: { xp: 0, level: maxLevel + 1 },
        },
      }),
      defaultConfig,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(`proficiency 'swordsmanship' level ${maxLevel + 1} out of range`);
    }
  });
});
