/**
 * Content Zod schemas, validation, and loader (M1-06).
 *
 * Requirements:
 * - Content is data. Adding content must not require core logic changes.
 * - Schemas and loader live in src/data/. Types inferred via z.infer.
 * - Strict schema validation + comprehensive cross-reference validation.
 * - Collects ALL cross-reference errors into a single ContentValidationError.
 *
 * No Math.random(), Date.now(), or DOM access here.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Effect Definition Schemas
// ---------------------------------------------------------------------------

const baseEffectDef = {
  id: z.string().min(1),
  name: z.string().min(1),
  duration: z.number().positive(),
  stacking: z.enum(['refresh', 'stack', 'ignore']).default('refresh'),
  maxStacks: z.number().int().positive().default(3),
};

export const damageOverTimeEffectDefSchema = z
  .object({
    ...baseEffectDef,
    kind: z.literal('damageOverTime'),
    tickInterval: z.number().positive(),
    damagePerTick: z.number().nonnegative(),
  })
  .strict();

export const stunEffectDefSchema = z
  .object({
    ...baseEffectDef,
    kind: z.literal('stun'),
  })
  .strict();

export const effectDefSchema = z.discriminatedUnion('kind', [
  damageOverTimeEffectDefSchema,
  stunEffectDefSchema,
]);

// ---------------------------------------------------------------------------
// 2. Enemy Definition Schema
// ---------------------------------------------------------------------------

export const enemyDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    maxHp: z.number().positive(),
    damage: z.number().nonnegative(),
    attackInterval: z.number().positive(),
    xpReward: z.number().nonnegative(),
    isBoss: z.boolean().default(false),
    onHitEffects: z.array(z.string().min(1)).default([]),
  })
  .strict();

// ---------------------------------------------------------------------------
// 3. Wave Definition Schema
// ---------------------------------------------------------------------------

export const waveEnemySchema = z
  .object({
    enemyId: z.string().min(1),
    count: z.number().int().positive(),
  })
  .strict();

export const waveDefSchema = z
  .object({
    id: z.string().min(1),
    enemies: z.array(waveEnemySchema).min(1),
  })
  .strict();

// ---------------------------------------------------------------------------
// 4. Requirement Schema (M2-03)
// ---------------------------------------------------------------------------

const requirementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('level'),
    level: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('proficiency'),
    disciplineId: z.string().min(1),
    level: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('node'),
    nodeId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('stageCleared'),
    stageId: z.string().min(1),
  }),
]);

export type Requirement = z.infer<typeof requirementSchema>;

// ---------------------------------------------------------------------------
// 5. Stage Definition Schema
// ---------------------------------------------------------------------------

const stageDefBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  waves: z.array(z.string().min(1)).min(1),
  boss: z.string().min(1),
  bossXpBonus: z.number().nonnegative(),
  minWavesBeforeBoss: z.number().int().positive(),
  unlocksStageId: z.string().min(1).optional(),
  requirements: z.array(requirementSchema).optional(),
});

export const stageDefSchema = z.preprocess(
  (data: any) => ({
    ...data,
    requirements: data.requirements ?? [],
  }),
  stageDefBaseSchema.extend({
    requirements: z.array(requirementSchema),
  }).strict()
);

export type StageDef = z.output<typeof stageDefSchema>;

// ---------------------------------------------------------------------------
// 6. Discipline and Skill Tree Schemas (M2-01)
// ---------------------------------------------------------------------------

export const disciplineDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type DisciplineDef = z.infer<typeof disciplineDefSchema>;

export const proficiencyCurveSchema = z.object({
  /** Base XP required to advance from proficiency level 1 to 2. PLACEHOLDER. */
  baseXp: z.number().positive(),
  /** Multiplicative growth factor applied per proficiency level. PLACEHOLDER. */
  growthFactor: z.number().min(1),
  /** Maximum proficiency level. PLACEHOLDER. */
  maxLevel: z.number().int().positive(),
});

export type ProficiencyCurve = z.infer<typeof proficiencyCurveSchema>;

const statBonusEffectSchema = z.object({
  kind: z.literal('statBonus'),
  stat: z.enum(['maxHp', 'attack', 'critChance', 'attackRate', 'critDamage']),
  mode: z.enum(['flat', 'percent']),
  value: z.number(),
});

const grantOnHitEffectSchema = z.object({
  kind: z.literal('grantOnHitEffect'),
  effectId: z.string().min(1),
});

const skillNodeEffectSchema = z.discriminatedUnion('kind', [
  statBonusEffectSchema,
  grantOnHitEffectSchema,
]);

export type SkillNodeEffect = z.infer<typeof skillNodeEffectSchema>;

export const skillNodeDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    branch: z.enum(['center', 'paladin', 'berserker']),
    cost: z.number().int().positive(),
    prerequisites: z.array(z.string().min(1)).default([]),
    requirements: z.array(requirementSchema).default([]),
    pos: z.object({
      x: z.number().int(),
      y: z.number().int(),
    }),
    effects: z.array(skillNodeEffectSchema).min(1),
  })
  .strict();

export type SkillNodeDef = z.infer<typeof skillNodeDefSchema>;

// ---------------------------------------------------------------------------
// 5. Raw Content Schema & Inferred Types
// ---------------------------------------------------------------------------

export const defeatConfigSchema = z
  .object({
    retreatWaves: z.number().int().min(0).default(1),
    pauseSeconds: z.number().positive().default(3),
  })
  .strict();

export const rawContentSchema = z
  .object({
    effects: z.array(effectDefSchema),
    enemies: z.array(enemyDefSchema),
    waves: z.array(waveDefSchema),
    stages: z.array(stageDefSchema),
    playerBaseOnHitEffects: z.array(z.string().min(1)),
    startingStageId: z.string().min(1),
    defeat: defeatConfigSchema,
    disciplines: z.array(disciplineDefSchema),
    proficiencyCurve: proficiencyCurveSchema,
    skillNodes: z.array(skillNodeDefSchema),
  })
  .strict();

export const contentSchema = rawContentSchema;

export type DefeatConfig = z.infer<typeof defeatConfigSchema>;
export type DamageOverTimeEffectDef = z.infer<typeof damageOverTimeEffectDefSchema>;
export type StunEffectDef = z.infer<typeof stunEffectDefSchema>;
export type EffectDef = z.infer<typeof effectDefSchema>;
export type EnemyDef = z.infer<typeof enemyDefSchema>;
export type WaveEnemy = z.infer<typeof waveEnemySchema>;
export type WaveDef = z.infer<typeof waveDefSchema>;
export type RawContent = z.infer<typeof rawContentSchema>;

// ---------------------------------------------------------------------------
// 6. Validated Content Container
// ---------------------------------------------------------------------------

export interface Content {
  readonly effects: ReadonlyMap<string, EffectDef>;
  readonly enemies: ReadonlyMap<string, EnemyDef>;
  readonly waves: ReadonlyMap<string, WaveDef>;
  readonly stages: ReadonlyMap<string, StageDef>;
  readonly playerBaseOnHitEffects: readonly string[];
  readonly startingStageId: string;
  readonly defeat: DefeatConfig;
  readonly disciplines: ReadonlyMap<string, DisciplineDef>;
  readonly proficiencyCurve: ProficiencyCurve;
  readonly skillNodes: ReadonlyMap<string, SkillNodeDef>;
  readonly raw: RawContent;
}

// ---------------------------------------------------------------------------
// 7. Validation Error & Loader
// ---------------------------------------------------------------------------

export class ContentValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(
      `Content validation failed with ${errors.length} error(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
    this.name = 'ContentValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ContentValidationError.prototype);
  }
}

function collectDuplicates<T extends { id: string }>(
  items: readonly T[],
  collectionName: string,
  errors: string[],
): Map<string, T> {
  const map = new Map<string, T>();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      errors.push(`Duplicate ${collectionName} id: '${item.id}'`);
    } else {
      seen.add(item.id);
      map.set(item.id, item);
    }
  }
  return map;
}

/**
 * Validates raw content against Zod schemas and performs comprehensive
 * cross-reference validation across all entities.
 *
 * Throws ContentValidationError listing all issues if validation fails.
 */
export function loadContent(raw: unknown): Content {
  const parsed = rawContentSchema.parse(raw);
  const errors: string[] = [];

  // 1. Check duplicate ids within each collection
  const effects = collectDuplicates(parsed.effects, 'effect', errors);
  const enemies = collectDuplicates(parsed.enemies, 'enemy', errors);
  const waves = collectDuplicates(parsed.waves, 'wave', errors);
  const stages = collectDuplicates(parsed.stages, 'stage', errors);
  const disciplines = collectDuplicates(parsed.disciplines, 'discipline', errors);
  const skillNodes = collectDuplicates(parsed.skillNodes, 'skillNode', errors);

  // 2. Enemy onHitEffects referencing a missing effect
  for (const enemy of parsed.enemies) {
    for (const effectId of enemy.onHitEffects) {
      if (!effects.has(effectId)) {
        errors.push(`Enemy '${enemy.id}' onHitEffects references nonexistent effect '${effectId}'`);
      }
    }
  }

  // 2b. Player base onHitEffects referencing a missing effect
  for (const effectId of parsed.playerBaseOnHitEffects) {
    if (!effects.has(effectId)) {
      errors.push(`playerBaseOnHitEffects references nonexistent effect '${effectId}'`);
    }
  }

  // 3. Wave enemies referencing a missing enemy
  // 4. Boss enemy (isBoss: true) appearing inside a regular wave
  for (const wave of parsed.waves) {
    for (const enemyRef of wave.enemies) {
      const enemy = enemies.get(enemyRef.enemyId);
      if (!enemy) {
        errors.push(`Wave '${wave.id}' references nonexistent enemy '${enemyRef.enemyId}'`);
      } else if (enemy.isBoss) {
        errors.push(
          `Wave '${wave.id}' contains boss enemy '${enemyRef.enemyId}' (bosses cannot appear in regular waves)`,
        );
      }
    }
  }

  // 5. Stage waves referencing a missing wave
  // 6. Stage boss referencing a missing enemy or non-boss enemy
  // 7. Stage unlocksStageId referencing a missing stage
  for (const stage of parsed.stages) {
    for (const waveId of stage.waves) {
      if (!waves.has(waveId)) {
        errors.push(`Stage '${stage.id}' waves references nonexistent wave '${waveId}'`);
      }
    }

    const bossEnemy = enemies.get(stage.boss);
    if (!bossEnemy) {
      errors.push(`Stage '${stage.id}' boss references nonexistent enemy '${stage.boss}'`);
    } else if (!bossEnemy.isBoss) {
      errors.push(`Stage '${stage.id}' boss references non-boss enemy '${stage.boss}' (isBoss must be true)`);
    }

    if (stage.unlocksStageId !== undefined && !stages.has(stage.unlocksStageId)) {
      errors.push(`Stage '${stage.id}' unlocksStageId points to nonexistent stage '${stage.unlocksStageId}'`);
    }
  }

  // 8. Validate startingStageId exists in stages
  if (!stages.has(parsed.startingStageId)) {
    errors.push(`startingStageId points to nonexistent stage '${parsed.startingStageId}'`);
  }

  // 9. Skill node validation
  // 9a. Validate prerequisite ids exist
  for (const node of parsed.skillNodes) {
    for (const prereqId of node.prerequisites) {
      if (!skillNodes.has(prereqId)) {
        errors.push(`Node '${node.id}' prerequisite references nonexistent node '${prereqId}'`);
      }
    }
  }

  // 9b. Validate no prerequisite cycles
  function hasCycle(nodeId: string, visited: Set<string>, path: Set<string>): boolean {
    if (path.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    path.add(nodeId);
    
    const node = skillNodes.get(nodeId);
    if (node) {
      for (const prereqId of node.prerequisites) {
        if (hasCycle(prereqId, visited, path)) return true;
      }
    }
    
    path.delete(nodeId);
    return false;
  }
  
  const visited = new Set<string>();
  for (const node of parsed.skillNodes) {
    if (hasCycle(node.id, visited, new Set())) {
      errors.push(`Node '${node.id}' has a prerequisite cycle`);
    }
  }

  // 9c. Validate node doesn't list itself as prerequisite
  for (const node of parsed.skillNodes) {
    if (node.prerequisites.includes(node.id)) {
      errors.push(`Node '${node.id}' lists itself as a prerequisite`);
    }
  }

  // 9d. Validate requirement discipline ids, node ids, and stage ids exist
  for (const node of parsed.skillNodes) {
    for (const req of node.requirements) {
      if (req.kind === 'proficiency' && !disciplines.has(req.disciplineId)) {
        errors.push(`Node '${node.id}' requirement references nonexistent discipline '${req.disciplineId}'`);
      } else if (req.kind === 'node' && !skillNodes.has(req.nodeId)) {
        errors.push(`Node '${node.id}' requirement references nonexistent node '${req.nodeId}'`);
      } else if (req.kind === 'stageCleared' && !stages.has(req.stageId)) {
        errors.push(`Node '${node.id}' requirement references nonexistent stage '${req.stageId}'`);
      }
    }
  }

  // 9e. Validate grantOnHitEffect effect ids exist
  for (const node of parsed.skillNodes) {
    for (const effect of node.effects) {
      if (effect.kind === 'grantOnHitEffect' && !effects.has(effect.effectId)) {
        errors.push(`Node '${node.id}' grantOnHitEffect references nonexistent effect '${effect.effectId}'`);
      }
    }
  }

  // 9f. Validate non-center nodes have prerequisites
  for (const node of parsed.skillNodes) {
    if (node.branch !== 'center' && node.prerequisites.length === 0) {
      errors.push(`Node '${node.id}' is in branch '${node.branch}' but has no prerequisites`);
    }
  }

  // 10. Validate stage requirement references
  for (const stage of parsed.stages) {
    for (const req of stage.requirements) {
      if (req.kind === 'proficiency' && !disciplines.has(req.disciplineId)) {
        errors.push(`Stage '${stage.id}' requirement references nonexistent discipline '${req.disciplineId}'`);
      } else if (req.kind === 'node' && !skillNodes.has(req.nodeId)) {
        errors.push(`Stage '${stage.id}' requirement references nonexistent node '${req.nodeId}'`);
      } else if (req.kind === 'stageCleared' && !stages.has(req.stageId)) {
        errors.push(`Stage '${stage.id}' requirement references nonexistent stage '${req.stageId}'`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ContentValidationError(errors);
  }

  return {
    effects,
    enemies,
    waves,
    stages,
    playerBaseOnHitEffects: parsed.playerBaseOnHitEffects,
    startingStageId: parsed.startingStageId,
    defeat: parsed.defeat,
    disciplines,
    proficiencyCurve: parsed.proficiencyCurve,
    skillNodes,
    raw: parsed,
  };
}
