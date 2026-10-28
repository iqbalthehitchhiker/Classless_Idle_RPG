/**
 * Starter disciplines (M2-01).
 * 
 * PLACEHOLDER values for proficiency curve.
 */
import type { DisciplineDef, ProficiencyCurve } from '../schemas.js';

export const starterDisciplines: DisciplineDef[] = [
  {
    id: 'swordsmanship',
    name: 'Swordsmanship',
  },
  {
    id: 'fortitude',
    name: 'Fortitude',
  },
];

export const starterProficiencyCurve: ProficiencyCurve = {
  baseXp: 20,        // PLACEHOLDER
  growthFactor: 1.3, // PLACEHOLDER
  maxLevel: 10,      // PLACEHOLDER
};
