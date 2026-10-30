/** M1-13 storage helpers.

One key: classlessIdleRpg.save. Every read/write is wrapped in try/catch so
a hostile or full storage backend never crashes the game.

Per D20, on any load failure the raw string is copied to
classlessIdleRpg.save.corrupt, the original key is left untouched, and the
error is returned to UI so autosave can be disabled until the player resets.
*/

import { createInitialState, dispatch, type GameConfig } from '../core/index.js';
import type { GameState } from '../core/types.js';
import { SAVE_VERSION, saveFileSchema, migrate, type SaveFile } from './schema.js';

const CORRUPT_SUFFIX = '.corrupt';
const SAVE_KEY = 'classlessIdleRpg.save';
const CORRUPT_KEY = SAVE_KEY + CORRUPT_SUFFIX;

type LoadResult =
  | { ok: true; state: GameState; savedAt: number }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Raw storage access (D20: every call wrapped in try/catch)
// ---------------------------------------------------------------------------

function readSave(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSave(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort persistence — individual write failures do not crash the game.
  }
}

// ---------------------------------------------------------------------------
// Migration (v1 -> v2, per decisions.md D19/D35)
// ---------------------------------------------------------------------------

// `migrate` is imported from schema.ts; kept here for documentation.
// v1 is upgraded to v2 (empty purchasedNodes, default proficiency, v1
// combat stageId becomes v2 activity params). v2 passes through. Other
// versions are rejected by migrate with a clear error.

// ---------------------------------------------------------------------------
// Serialize / deserialize
// ---------------------------------------------------------------------------

/** Serialize the current game state into a save string.

Per D19 the save holds progression only. Combat runtime is intentionally
absent; on load an active combat restarts from wave 0 of the saved stage
with full HP.
*/
export function serialize(state: GameState): string {
  // Store the active activity with its params per D35:
  // combat -> { stageId }, training -> { disciplineId }, idle -> null.
  let activityParams:
    | { stageId?: string; disciplineId?: string }
    | null = null;
  if (state.activeActivity === 'combat') {
    activityParams = { stageId: state.combat?.stageId ?? undefined };
  } else if (state.activeActivity === 'training') {
    activityParams = { disciplineId: state.trainingDisciplineId ?? undefined };
  }

  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAt: state.savedAt ?? Date.now(),
    state: {
      character: state.character,
      unlockedStages: state.unlockedStages,
      clearedStages: state.clearedStages,
      settings: state.settings,
      elapsedMs: state.elapsedMs,
      rng: state.rng,
      log: state.log,
      purchasedNodes: state.purchasedNodes,
      proficiency: state.proficiency,
      activeActivity: state.activeActivity,
      activityParams,
    },
  };
  return JSON.stringify(file);
}

/** Deserialize + validate a save string.

Never throws: any failure is reported as `{ ok: false, error }`.
*/
export function deserialize(
  raw: string,
  config: GameConfig,
): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Save is not valid JSON' };
  }

  const migrated: SaveFile = migrate(parsed, config);

  let file: SaveFile;
  try {
    // Validate against the current save schema; unknown/newer versions fail
    // here because version is a literal.
    file = saveFileSchema.parse(migrated) as SaveFile;
  } catch (err) {
    return { ok: false, error: `Save failed validation: ${err}` };
  }

  const stages = config.content.stages;
  const maxProficiencyLevel = config.content.proficiencyCurve.maxLevel;
  const purchased = file.state.purchasedNodes;

  // Validate every id referenced by the save actually exists in content.
  for (const id of file.state.unlockedStages) {
    if (!stages.has(id)) {
      return {
        ok: false,
        error: `unlockedStages references nonexistent stage '${id}'`,
      };
    }
  }

  for (const id of file.state.clearedStages) {
    if (!stages.has(id)) {
      return {
        ok: false,
        error: `clearedStages references nonexistent stage '${id}'`,
      };
    }
  }

  // purchasedNodes: every id exists, no duplicates, all prerequisites owned.
  if (new Set(purchased).size !== purchased.length) {
    return { ok: false, error: 'purchasedNodes contains duplicate ids' };
  }

  for (const id of purchased) {
    if (!config.content.skillNodes.has(id)) {
      return {
        ok: false,
        error: `purchasedNodes references nonexistent node '${id}'`,
      };
    }
  }

  for (const id of purchased) {
    const node = config.content.skillNodes.get(id);
    if (!node) continue;
    for (const prereqId of node.prerequisites) {
      if (!purchased.includes(prereqId)) {
        return {
          ok: false,
          error: `purchased node '${id}' requires unowned prerequisite '${prereqId}'`,
        };
      }
    }
  }

  // proficiency: valid disciplines, level within 1..maxLevel, finite non-negative xp.
  for (const [disciplineId, prof] of Object.entries(file.state.proficiency)) {
    if (!config.content.disciplines.has(disciplineId)) {
      return {
        ok: false,
        error: `proficiency references nonexistent discipline '${disciplineId}'`,
      };
    }
    if (
      !Number.isFinite(prof.level) ||
      prof.level < 1 ||
      prof.level > maxProficiencyLevel
    ) {
      return {
        ok: false,
        error: `proficiency '${disciplineId}' level ${prof.level} out of range 1..${maxProficiencyLevel}`,
      };
    }
    if (!Number.isFinite(prof.xp) || prof.xp < 0) {
      return {
        ok: false,
        error: `proficiency '${disciplineId}' xp ${prof.xp} must be finite and non-negative`,
      };
    }
  }

  // Activity params per D35: combat references an existing stage, training an
  // existing discipline.
  if (file.state.activeActivity !== null) {
    if (!file.state.activityParams) {
      return {
        ok: false,
        error: `activeActivity '${file.state.activeActivity}' is missing activity params`,
      };
    }
    if (file.state.activeActivity === 'combat') {
      const stageId = file.state.activityParams.stageId;
      if (typeof stageId !== 'string' || !stages.has(stageId)) {
        return {
          ok: false,
          error: `combat activity params reference nonexistent stage '${String(stageId)}'`,
        };
      }
    } else {
      const disciplineId = file.state.activityParams.disciplineId;
      if (
        typeof disciplineId !== 'string' ||
        !config.content.disciplines.has(disciplineId)
      ) {
        return {
          ok: false,
          error: `training activity params reference nonexistent discipline '${String(disciplineId)}'`,
        };
      }
    }
  }

  // State rebuild: start from initial state, then layer saved fields.
  const base = createInitialState(file.state.rng.seed, config);
  const rebuilt: GameState = {
    ...base,
    character: file.state.character,
    unlockedStages: file.state.unlockedStages,
    clearedStages: file.state.clearedStages,
    settings: file.state.settings,
    elapsedMs: file.state.elapsedMs,
    rng: file.state.rng,
    log: file.state.log,
    purchasedNodes: file.state.purchasedNodes,
    proficiency: { ...base.proficiency, ...file.state.proficiency },
    savedAt: file.savedAt,
    // Combat is restarted, not stored (D19).
    combat: null,
    activeActivity: null,
    trainingDisciplineId: null,
    remainderMs: base.remainderMs,
  };

  // Restart the saved activity through dispatch per D35. If it can't start
  // (stage locked/discipline unknown), fall back to idle.
  if (file.state.activeActivity !== null && file.state.activityParams) {
    const activityResult = dispatch(
      rebuilt,
      {
        type: 'startActivity',
        activityId: file.state.activeActivity,
        params: file.state.activityParams,
      },
      config,
    );

    if (activityResult.activeActivity === file.state.activeActivity) {
      return { ok: true, state: activityResult, savedAt: file.savedAt };
    }
  }

  return { ok: true, state: rebuilt, savedAt: file.savedAt };
}

// ---------------------------------------------------------------------------
// Public storage API
// ---------------------------------------------------------------------------

/** Load the saved game. If there is no saved game, this is a new game.

On any failure, the bad save is copied to the corrupt key, the original key
is left untouched, and the error is returned so UI can show a reset path.
*/
export function loadGame(config: GameConfig): LoadResult {
  const raw = readSave(SAVE_KEY);
  if (raw === null) {
    return {
      ok: true,
      state: createInitialState(Date.now(), config),
      savedAt: Date.now(),
    };
  }

  const result = deserialize(raw, config);
  if (!result.ok) {
    // D20: copy the bad save to the corrupt key, leave the original untouched.
    writeSave(CORRUPT_KEY, raw);
    return result;
  }

  return { ok: true, state: result.state, savedAt: Date.now() };
}

/** Persist the current state.

Always wraps the write in try/catch.
*/
export function saveGame(state: GameState): void {
  try {
    writeSave(SAVE_KEY, serialize(state));
  } catch {
    // Best-effort persistence — individual write failures do not crash the game.
  }
}

/** Reset the save and return a fresh initial state.

Also removes the corrupt key so a bad save does not keep surfacing.
*/
export function resetGame(config: GameConfig): GameState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialState(Date.now(), config);
    }
    window.localStorage.removeItem(SAVE_KEY);
    window.localStorage.removeItem(CORRUPT_KEY);
  } catch {
    // Best-effort cleanup.
  }

  return createInitialState(Date.now(), config);
}
