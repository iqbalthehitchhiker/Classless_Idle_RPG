/**
 * Training configuration (M2-04).
 *
 * All values are PLACEHOLDERs pending balance tuning.
 */
import { z } from 'zod';

export const trainingConfigSchema = z
  .object({
    /** Proficiency XP gained per second of training. PLACEHOLDER. */
    proficiencyPerSecond: z.number().nonnegative(),
    /** Character XP gained per second of training. PLACEHOLDER. */
    xpPerSecond: z.number().nonnegative(),
    /** Fraction of the training proficiency rate gained per second of combat
     * (Swordsmanship only). PLACEHOLDER. */
    combatProficiencyFraction: z.number().nonnegative(),
  })
  .strict();

export type TrainingConfig = z.infer<typeof trainingConfigSchema>;

export const trainingConfig: TrainingConfig = trainingConfigSchema.parse({
  proficiencyPerSecond: 0.5,
  xpPerSecond: 0.2,
  combatProficiencyFraction: 0.2,
});
