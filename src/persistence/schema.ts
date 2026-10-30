/** M2-05 save schema (Zod). Version 2.

Per D19/D35 the save holds progression plus the active activity with its
params (combat: stageId; training: disciplineId). Combat runtime (enemies,
effects, timers, phase) is intentionally absent; on load an active combat
restarts at wave 0 of the saved stage with full HP.

Numbers must be finite, level >= 1, currentHp >= 0. No derived values, no
combat runtime.
*/

import { z } from 'zod';
import type { GameConfig } from '../core/types.js';

// Re-export so tests can pin the expected version.
export const SAVE_VERSION = 2;

const idListSchema = z
  .array(z.string().min(1))
  .max(1000)
  .readonly()
  .default([]);

const logEntrySchema = z.object({
  tMs: z.number().int().finite(),
  type: z.enum([
    'enemyKilled',
    'waveCleared',
    'bossSpawned',
    'bossKilled',
    'stageUnlocked',
    'levelUp',
    'playerDefeated',
    'recoveryEnded',
    'skillLearned',
    'skillsReset',
  ]),
  detail: z.string(),
});

// v1 save shape, used only by the v1 -> v2 migration.
  interface V1SaveState {
  character: {
    level: number;
    xp: number;
    skillPoints: number;
    currentHp: number;
  };
  unlockedStages: string[];
  clearedStages: string[];
  settings: { autoProgress: boolean };
  elapsedMs: number;
  rng: { seed: number };
  log: unknown[];
  activeActivity: 'combat' | 'training' | null;
  stageId: string | null;
}

interface V1Save {
  version: 1;
  savedAt: number;
  state: V1SaveState;
}

export const saveFileSchema = z
  .object({
    version: z.literal(SAVE_VERSION),
    savedAt: z.number().int().finite(),
    state: z
      .object({
        // Progression-only fields per D19.
        character: z.object({
          level: z.number().int().min(1),
          xp: z.number().finite(),
          skillPoints: z.number().int().nonnegative(),
          currentHp: z.number().finite().min(0),
        }),
        unlockedStages: idListSchema,
        clearedStages: idListSchema,
        settings: z
          .object({
            autoProgress: z.boolean(),
          })
          .readonly(),
        elapsedMs: z.number().int().finite().min(0),
        rng: z.object({ seed: z.number().int().finite() }),
        log: z
          .array(logEntrySchema)
          .max(10000)
          .readonly(),
        purchasedNodes: idListSchema,
        proficiency: z
          .record(
            z.string(),
            z.object({
              xp: z.number().finite().nonnegative(),
              level: z.number().int().min(1),
            }),
          )
          .readonly(),
        activeActivity: z.enum(['combat', 'training']).nullable().default(null),
        activityParams: z
          .object({
            stageId: z.string().min(1).optional(),
            disciplineId: z.string().min(1).optional(),
          })
          .nullable()
          .default(null),
      })
      .readonly(),
  })
  .strict();

export type SaveFile = z.infer<typeof saveFileSchema>;

/**
 * Upgrade a raw save to the current version (2).
 *
 * - v1 -> v2: adds purchasedNodes ([]), proficiency (level 1 / xp 0 for every
 *   discipline in content), and converts the v1 combat stageId into v2
 *   activity params.
 * - v2 passes through unchanged.
 * - Any other version (missing, below 1, above 2) throws a clear error.
 */
export function migrate(raw: unknown, config: GameConfig): SaveFile {
  let version: unknown;
  if (raw !== null && typeof raw === 'object' && 'version' in raw) {
    version = (raw as { version: unknown }).version;
  }

  if (version !== 1 && version !== 2) {
    throw new Error(
      `Unsupported save version: ${version === undefined ? 'missing' : String(version)} (expected 1 or 2)`,
    );
  }

  if (version === 2) {
    return raw as SaveFile;
  }

  const v1 = raw as V1Save;

  const proficiency: Record<string, { xp: number; level: number }> = {};
  for (const discipline of config.content.disciplines.values()) {
    proficiency[discipline.id] = { xp: 0, level: 1 };
  }

  // v1 combat stageId becomes v2 activity params (D35). A v1 training save
  // has no storable params, so it restarts as idle on load.
  const activityParams =
    v1.state.activeActivity === 'combat' && v1.state.stageId !== null
      ? { stageId: v1.state.stageId }
      : null;

  return {
    version: 2,
    savedAt: v1.savedAt,
    state: {
      character: v1.state.character,
      unlockedStages: v1.state.unlockedStages,
      clearedStages: v1.state.clearedStages,
      settings: v1.state.settings,
    elapsedMs: v1.state.elapsedMs,
    rng: v1.state.rng,
    log: v1.state.log as SaveFile['state']['log'],
    purchasedNodes: [],
      proficiency,
      activeActivity: v1.state.activeActivity,
      activityParams,
    },
  };
}
