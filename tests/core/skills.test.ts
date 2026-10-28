/**
 * Skill tree purchase, respec, and modifier tests (M2-02).
 */
import { describe, it, expect } from 'vitest';
import { createInitialState, dispatch, deriveStats, deriveOnHitEffects } from '../../src/core/index.js';
import { defaultConfig } from '../../src/data/index.js';
import type { GameConfig } from '../../src/core/types.js';

describe('Skill modifiers (M2-02)', () => {
  it('applies flat stat bonuses correctly', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };

    // Purchase center-root (flat +10 maxHp)
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);

    const stats = deriveStats(state, defaultConfig);
    const baseStats = deriveStats(
      { ...state, purchasedNodes: [] },
      defaultConfig,
    );

    expect(stats.maxHp).toBe(baseStats.maxHp + 10);
  });

  it('applies percent stat bonuses correctly (additive)', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 20 } };

    // Purchase path to center-hp-3 (10% maxHp)
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-1' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-hp-2' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-crit-1' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-2' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-hp-3' }, defaultConfig);

    // Purchase paladin-entry (12% maxHp)
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'paladin-entry' }, defaultConfig);

    const stats = deriveStats(state, defaultConfig);
    const baseStats = deriveStats(
      { ...state, purchasedNodes: [] },
      defaultConfig,
    );

    // Percent bonuses add: 10% + 12% = 22% total
    // Also has flat bonuses from center-root (+10) and center-hp-2 (+15)
    const expectedMaxHp = (baseStats.maxHp + 10 + 15) * (1 + 0.1 + 0.12);
    expect(stats.maxHp).toBeCloseTo(expectedMaxHp, 5);
  });

  it('floors multiplier at 0 when percent sum below -1', () => {
    // Create a custom config with a negative percent node for testing
    const testConfig: GameConfig = {
      ...defaultConfig,
      content: {
        ...defaultConfig.content,
        skillNodes: new Map([
          [
            'test-negative',
            {
              id: 'test-negative',
              name: 'Test Negative',
              branch: 'center',
              cost: 1,
              prerequisites: [],
              requirements: [],
              pos: { x: 0, y: 0 },
              effects: [
                { kind: 'statBonus', stat: 'attack', mode: 'percent', value: -1.5 },
              ],
            },
          ],
        ]),
      },
    };

    let state = createInitialState(1, testConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };
    state = { ...state, purchasedNodes: ['test-negative'] };

    const stats = deriveStats(state, testConfig);

    // Base attack * max(0, 1 + (-1.5)) = base * 0
    expect(stats.attack).toBe(0);
  });

  it('clamps crit chance to critChanceCap', () => {
    // Create a config with a massive crit chance boost
    const testConfig: GameConfig = {
      ...defaultConfig,
      content: {
        ...defaultConfig.content,
        skillNodes: new Map([
          [
            'test-crit',
            {
              id: 'test-crit',
              name: 'Test Crit',
              branch: 'center',
              cost: 1,
              prerequisites: [],
              requirements: [],
              pos: { x: 0, y: 0 },
              effects: [
                { kind: 'statBonus', stat: 'critChance', mode: 'flat', value: 10 },
              ],
            },
          ],
        ]),
      },
    };

    let state = createInitialState(1, testConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };
    state = { ...state, purchasedNodes: ['test-crit'] };

    const stats = deriveStats(state, testConfig);

    // Should be capped at critChanceCap (1.0)
    expect(stats.critChance).toBe(testConfig.character.critChanceCap);
  });

  it('floors attack speed at attackRateMin', () => {
    // Create a config with a negative attack speed modifier
    const testConfig: GameConfig = {
      ...defaultConfig,
      content: {
        ...defaultConfig.content,
        skillNodes: new Map([
          [
            'test-slow',
            {
              id: 'test-slow',
              name: 'Test Slow',
              branch: 'center',
              cost: 1,
              prerequisites: [],
              requirements: [],
              pos: { x: 0, y: 0 },
              effects: [
                { kind: 'statBonus', stat: 'attackRate', mode: 'percent', value: -2 },
              ],
            },
          ],
        ]),
      },
    };

    let state = createInitialState(1, testConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };
    state = { ...state, purchasedNodes: ['test-slow'] };

    const stats = deriveStats(state, testConfig);

    // Should be floored at attackRateMin
    expect(stats.attackRate).toBe(testConfig.character.attackRateMin);
  });

  it('grants on-hit effect from node without duplicates', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 20 } };

    // Purchase path to berserker-ignite (grants burn)
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-1' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-hp-2' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-crit-1' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-2' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'berserker-entry' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'berserker-crit-damage' }, defaultConfig);

    // Before capstone
    let effects = deriveOnHitEffects(state, defaultConfig);
    expect(effects).toContain('burn'); // from playerBaseOnHitEffects

    // Purchase berserker-ignite (grants burn again)
    state = { ...state, character: { ...state.character, skillPoints: 10 } };
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'berserker-attack-speed' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'berserker-attack-2' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'berserker-ignite' }, defaultConfig);

    effects = deriveOnHitEffects(state, defaultConfig);
    // No duplicates: burn should appear only once
    const burnCount = effects.filter((e) => e === 'burn').length;
    expect(burnCount).toBe(1);
  });
});

describe('Purchase rules (M2-02)', () => {
  it('rejects purchase for unknown node id', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };

    const before = JSON.stringify(state);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'nonexistent' }, defaultConfig);
    const after = JSON.stringify(state);

    expect(after).toBe(before);
  });

  it('rejects purchase for already owned node', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };

    // Purchase once
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    expect(state.purchasedNodes).toContain('center-root');
    const pointsAfterFirst = state.character.skillPoints;

    // Try to purchase again
    const before = JSON.stringify(state);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    const after = JSON.stringify(state);

    expect(after).toBe(before);
    expect(state.character.skillPoints).toBe(pointsAfterFirst);
  });

  it('rejects purchase for missing prerequisite', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };

    // Try to purchase center-attack-1 without center-root
    const before = JSON.stringify(state);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-1' }, defaultConfig);
    const after = JSON.stringify(state);

    expect(after).toBe(before);
  });

  it('rejects purchase for insufficient skill points', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 0 } };

    const before = JSON.stringify(state);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    const after = JSON.stringify(state);

    expect(after).toBe(before);
  });

  it('successful purchase subtracts exact cost', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 10 } };

    const pointsBefore = state.character.skillPoints;
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);

    const node = defaultConfig.content.skillNodes.get('center-root');
    expect(node).toBeDefined();
    expect(state.character.skillPoints).toBe(pointsBefore - node!.cost);
    expect(state.purchasedNodes).toContain('center-root');
  });
});

describe('Respec (M2-02)', () => {
  it('refunds exact total cost and clears nodes', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 20 } };

    const initialPoints = state.character.skillPoints;

    // Purchase several nodes
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-1' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-hp-2' }, defaultConfig);

    const spent = initialPoints - state.character.skillPoints;
    expect(state.purchasedNodes.length).toBe(3);

    // Respec
    state = dispatch(state, { type: 'respec' }, defaultConfig);

    expect(state.purchasedNodes.length).toBe(0);
    expect(state.character.skillPoints).toBe(initialPoints);
    expect(state.character.skillPoints).toBe(spent + (initialPoints - spent));
  });

  it('rejects respec while combat is running', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 20 } };

    // Purchase a node
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    const pointsAfter = state.character.skillPoints;

    // Start combat
    state = dispatch(
      state,
      { type: 'startActivity', activityId: 'combat', params: { stageId: 'stage-1' } },
      defaultConfig,
    );
    expect(state.activeActivity).toBe('combat');

    // Try to respec
    const before = JSON.stringify(state);
    state = dispatch(state, { type: 'respec' }, defaultConfig);
    const after = JSON.stringify(state);

    expect(after).toBe(before);
    expect(state.purchasedNodes.length).toBe(1);
    expect(state.character.skillPoints).toBe(pointsAfter);
  });

  it('clamps currentHp after respec when maxHp changes', () => {
    let state = createInitialState(1, defaultConfig);
    state = { ...state, character: { ...state.character, skillPoints: 20 } };

    // Purchase HP-boosting nodes
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-root' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-attack-1' }, defaultConfig);
    state = dispatch(state, { type: 'purchaseNode', nodeId: 'center-hp-2' }, defaultConfig);

    const statsWithNodes = deriveStats(state, defaultConfig);
    state = { ...state, character: { ...state.character, currentHp: statsWithNodes.maxHp } };

    // Respec
    state = dispatch(state, { type: 'respec' }, defaultConfig);

    const statsWithoutNodes = deriveStats(state, defaultConfig);
    expect(state.character.currentHp).toBeLessThanOrEqual(statsWithoutNodes.maxHp);
    expect(state.character.currentHp).toBe(statsWithoutNodes.maxHp);
  });
});
