/**
 * Requirements system (M2-03).
 *
 * Shared requirement checking for skill nodes and stages.
 * Returns all unmet requirements with readable text for the UI.
 */

import type { GameConfig, GameState } from './types.js';
import type { Requirement } from '../data/schemas.js';

export interface UnmetRequirement {
  readonly requirement: Requirement;
  readonly text: string;
}

export type RequirementCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly unmet: readonly UnmetRequirement[] };

/**
 * Check if all requirements are met. Returns { ok: true } if all requirements
 * pass, or { ok: false, unmet } with all unmet requirements and readable text.
 */
export function checkRequirements(
  state: GameState,
  requirements: readonly Requirement[],
  config: GameConfig,
): RequirementCheckResult {
  if (requirements.length === 0) {
    return { ok: true };
  }

  const unmet: UnmetRequirement[] = [];

  for (const req of requirements) {
    if (req.kind === 'level') {
      if (state.character.level < req.level) {
        unmet.push({
          requirement: req,
          text: `Character level ${req.level} (you are ${state.character.level})`,
        });
      }
    } else if (req.kind === 'proficiency') {
      const proficiencyLevel = state.proficiency[req.disciplineId]?.level ?? 0;
      if (proficiencyLevel < req.level) {
        const discipline = config.content.disciplines.get(req.disciplineId);
        const disciplineName = discipline?.name ?? req.disciplineId;
        unmet.push({
          requirement: req,
          text: `${disciplineName} level ${req.level} (you have ${proficiencyLevel})`,
        });
      }
    } else if (req.kind === 'node') {
      if (!state.purchasedNodes.includes(req.nodeId)) {
        const node = config.content.skillNodes.get(req.nodeId);
        const nodeName = node?.name ?? req.nodeId;
        unmet.push({
          requirement: req,
          text: `Needs skill: ${nodeName}`,
        });
      }
    } else if (req.kind === 'stageCleared') {
      if (!state.clearedStages.includes(req.stageId)) {
        const stage = config.content.stages.get(req.stageId);
        const stageName = stage?.name ?? req.stageId;
        unmet.push({
          requirement: req,
          text: `Clear stage: ${stageName}`,
        });
      }
    }
  }

  if (unmet.length > 0) {
    return { ok: false, unmet };
  }

  return { ok: true };
}
