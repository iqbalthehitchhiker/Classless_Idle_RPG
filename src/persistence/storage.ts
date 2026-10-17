/** M1-13 storage helpers.

One key: classlessIdleRpg.save. Every read/write is wrapped in try/catch so
a hostile or full storage backend never crashes the game.

Per D20, on any load failure the raw string is copied to
classlessIdleRpg.save.corrupt, the original key is left untouched, and the
error is returned to UI so autosave can be disabled until the player resets.
*/

import { createInitialState, dispatch, type GameConfig } from '../core/index.js';
import type { GameState } from '../core/types.js';
import { SAVE_VERSION, saveFileSchema, type SaveFile } from './schema.js';

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
// Migration scaffold (v1 identity, per decisions.md D19/D20)
// ---------------------------------------------------------------------------

function migrateSave(raw: unknown): unknown {
  // v1 is the identity migration. Unknown or newer versions are rejected by
  // validation later, so this route does not attempt to handle them.
  return raw;
}

// ---------------------------------------------------------------------------
// Serialize / deserialize
// ---------------------------------------------------------------------------

/** Serialize the current game state into a save string.

Per D19 the save holds progression only. Combat runtime is intentionally
absent; on load an active combat restarts from wave 0 of the saved stage
with full HP.
*/
export function serialize(state: GameState): string {
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
      activeActivity: state.activeActivity,
      stageId: state.combat?.stageId ?? null,
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

  const migrated = migrateSave(parsed);

  let file: SaveFile;
  try {
    // Validate against the current save schema; unknown/newer versions fail
    // here because version is a literal.
    file = saveFileSchema.parse(migrated) as SaveFile;
  } catch (err) {
    return { ok: false, error: `Save failed validation: ${err}` };
  }

  const stages = config.content.stages;

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

  // stageId must be a non-null string if the save indicates an active combat
  // is restarting (D19).
  if (file.state.stageId !== null && !stages.has(file.state.stageId)) {
    return {
      ok: false,
      error: `stageId references nonexistent stage '${file.state.stageId}'`,
    };
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
    savedAt: file.savedAt,
    // Combat is restarted, not stored (D19).
    combat: null,
    activeActivity: null,
    remainderMs: base.remainderMs,
  };

  // If the saved activity was combat and there's a valid stageId, restart at
  // wave 1 of the saved stage with full HP per D19. If that stage can't start,
  // fall back to idle.
  if (file.state.activeActivity === 'combat' && file.state.stageId !== null) {
    const activityResult = dispatch(
      rebuilt,
      {
        type: 'startActivity',
        activityId: 'combat',
        params: { stageId: file.state.stageId },
      },
      config,
    );

    if (activityResult.activeActivity === 'combat') {
      return { ok: true, state: activityResult, savedAt: file.savedAt };
    }

    return { ok: true, state: rebuilt, savedAt: file.savedAt };
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
