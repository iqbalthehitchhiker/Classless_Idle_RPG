/** M1-13 save schema (Zod).

Per D19 the save holds progression only. Combat runtime (enemies, effects,
timers, phase) is intentionally absent; on load an active combat restarts at
wave 0 of the saved stage with full HP.

Numbers must be finite, level >= 1, currentHp >= 0. No derived values, no
combat runtime.
*/

import { z } from 'zod';

// Re-export so tests can pin the expected version.
export const SAVE_VERSION = 1;

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
        activeActivity: z
          .enum(['combat', 'training'])
          .nullable()
          .default(null),
        stageId: z.string().min(1).nullable().default(null),
      })
      .readonly(),
  })
  .strict();

export type SaveFile = z.infer<typeof saveFileSchema>;

