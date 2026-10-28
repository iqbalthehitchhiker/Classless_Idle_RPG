/**
 * Derived character statistics (M1-04, M2-02).
 *
 * FR-007: final statistics are calculated from base attributes and progression
 * bonuses. In Phase 1 the only progression bonus is level growth (D14); skill
 * tree modifiers attach here via `deriveStats`.
 *
 * Hard rule 5: derived statistics are never stored in GameState. Recalculate on
 * read (the UI does this every frame) — `CharacterState` keeps only progress
 * plus currentHp.
 *
 * No Math.random(), Date.now(), localStorage, or DOM access here.
 */
import type { CharacterStatsData } from '../data/character.js';
import { add, clamp, mul, pow, sub } from './num.js';
import type { GameConfig, GameState } from './types.js';

export interface DerivedStats {
  readonly maxHp: number;
  readonly attack: number;
  readonly attackRate: number;
  readonly critChance: number;
  readonly critDamage: number;
}

/** A critical hit is never weaker than a normal one. */
const MIN_CRIT_DAMAGE = 1;
/** Critical chance saturates rather than exceeding certainty. */
const MAX_CRIT_CHANCE = 1;

/** Coerce a level into a whole number >= 1 (structural, not game arithmetic). */
function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) {
    throw new RangeError(`stats: level must be finite, received ${level}`);
  }
  return Math.max(1, Math.floor(level));
}

/**
 * Derived statistics for a given character level: `base * growth^(level - 1)`.
 *
 * Levels below 1 are treated as level 1. Critical chance is clamped to
 * certainty and critical damage to at least 1× so long play cannot produce
 * degenerate values.
 */
export function deriveStatsForLevel(
  level: number,
  characterStatsData: CharacterStatsData,
): DerivedStats {
  const levelsGained = sub(normalizeLevel(level), 1);
  const { base, growthPerLevel } = characterStatsData;

  return {
    maxHp: mul(base.maxHp, pow(growthPerLevel.maxHp, levelsGained)),
    attack: mul(base.attack, pow(growthPerLevel.attack, levelsGained)),
    attackRate: mul(base.attackRate, pow(growthPerLevel.attackRate, levelsGained)),
    critChance: clamp(
      mul(base.critChance, pow(growthPerLevel.critChance, levelsGained)),
      0,
      MAX_CRIT_CHANCE,
    ),
    critDamage: clamp(
      mul(base.critDamage, pow(growthPerLevel.critDamage, levelsGained)),
      MIN_CRIT_DAMAGE,
      Number.POSITIVE_INFINITY,
    ),
  };
}

/** Accumulated flat and percent bonuses from purchased skill nodes, keyed by stat. */
interface AccumulatedModifiers {
  flat: {
    maxHp: number;
    attack: number;
    critChance: number;
    attackRate: number;
    critDamage: number;
  };
  percent: {
    maxHp: number;
    attack: number;
    critChance: number;
    attackRate: number;
    critDamage: number;
  };
}

/** Sum all statBonus effects from purchased nodes into flat and percent buckets. */
function accumulateModifiers(state: GameState, config: GameConfig): AccumulatedModifiers {
  const flat: AccumulatedModifiers['flat'] = {
    maxHp: 0,
    attack: 0,
    critChance: 0,
    attackRate: 0,
    critDamage: 0,
  };
  const percent: AccumulatedModifiers['percent'] = {
    maxHp: 0,
    attack: 0,
    critChance: 0,
    attackRate: 0,
    critDamage: 0,
  };

  for (const nodeId of state.purchasedNodes) {
    const node = config.content.skillNodes.get(nodeId);
    if (!node) continue;
    for (const effect of node.effects) {
      if (effect.kind !== 'statBonus') continue;
      const { stat, mode, value } = effect;
      if (mode === 'flat') {
        flat[stat] = add(flat[stat], value);
      } else {
        percent[stat] = add(percent[stat], value);
      }
    }
  }

  return { flat, percent };
}

/** Derived statistics for a state's character. Recalculated, never saved. */
export function deriveStats(state: GameState, config: GameConfig): DerivedStats {
  const { base, growthPerLevel, critChanceCap, attackRateMin } = config.character;
  const levelsGained = sub(normalizeLevel(state.character.level), 1);

  // Level bases. Crit chance and attack rate have no level base (D23): use the
  // config constant directly. All other stats grow with level (D14).
  const levelMaxHp = mul(base.maxHp, pow(growthPerLevel.maxHp, levelsGained));
  const levelAttack = mul(base.attack, pow(growthPerLevel.attack, levelsGained));
  const levelAttackRate = mul(base.attackRate, pow(growthPerLevel.attackRate, levelsGained));
  const levelCritChance = base.critChance; // D23: no level base, use config constant
  const levelCritDamage = mul(base.critDamage, pow(growthPerLevel.critDamage, levelsGained));

  // Accumulate modifiers from purchased nodes.
  const { flat, percent } = accumulateModifiers(state, config);

  // Apply modifier math: final = (levelBase + flat) x max(0, 1 + percentSum).
  // Percent bonuses add together across nodes.
  const maxHp = mul(add(levelMaxHp, flat.maxHp), Math.max(0, 1 + percent.maxHp));
  const attack = mul(add(levelAttack, flat.attack), Math.max(0, 1 + percent.attack));
  const critChance = clamp(
    add(levelCritChance, flat.critChance) * Math.max(0, 1 + percent.critChance),
    0,
    critChanceCap,
  );
  const attackRate = Math.max(
    attackRateMin,
    add(levelAttackRate, flat.attackRate) * Math.max(0, 1 + percent.attackRate),
  );
  const critDamage = clamp(
    mul(add(levelCritDamage, flat.critDamage), Math.max(0, 1 + percent.critDamage)),
    MIN_CRIT_DAMAGE,
    Number.POSITIVE_INFINITY,
  );

  return { maxHp, attack, attackRate, critChance, critDamage };
}

/** On-hit effect ids: player base effects plus effects granted by purchased nodes, no duplicates. */
export function deriveOnHitEffects(state: GameState, config: GameConfig): readonly string[] {
  const effectIds = new Set<string>();
  for (const id of config.content.playerBaseOnHitEffects) {
    effectIds.add(id);
  }
  for (const nodeId of state.purchasedNodes) {
    const node = config.content.skillNodes.get(nodeId);
    if (!node) continue;
    for (const effect of node.effects) {
      if (effect.kind === 'grantOnHitEffect') {
        effectIds.add(effect.effectId);
      }
    }
  }
  return [...effectIds];
}

/**
 * Rule: can the player purchase the given skill node? Returns { ok: true } or
 * { ok: false, reason } with readable reason text. Purchase rules: the node
 * exists, is not already owned, all prerequisites are owned, and cost is at most
 * character.skillPoints. Requirements (proficiency/level) are NOT enforced in
 * this task; see M2-03.
 */
export function canPurchaseNode(
  state: GameState,
  nodeId: string,
  config: GameConfig,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const node = config.content.skillNodes.get(nodeId);
  if (!node) {
    return { ok: false, reason: `Unknown skill node: '${nodeId}'` };
  }

  if (state.purchasedNodes.includes(nodeId)) {
    return { ok: false, reason: `Node '${node.name}' is already owned` };
  }

  for (const prereqId of node.prerequisites) {
    if (!state.purchasedNodes.includes(prereqId)) {
      return { ok: false, reason: `Prerequisite not owned: '${prereqId}'` };
    }
  }

  // M2-03: requirement check goes here (requirements are NOT enforced in this task)

  if (node.cost > state.character.skillPoints) {
    return {
      ok: false,
      reason: `Not enough skill points: need ${node.cost}, have ${state.character.skillPoints}`,
    };
  }

  return { ok: true };
}

/**
 * Rule: can the player respec? Free full respec, allowed only when no activity
 * is running (D29). Returns { ok: true } or { ok: false, reason }.
 */
export function canRespec(state: GameState): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (state.activeActivity !== null) {
    return { ok: false, reason: 'Cannot respec while an activity is running' };
  }
  return { ok: true };
}
