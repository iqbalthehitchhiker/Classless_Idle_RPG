/** src/persistence — Save, load, validate, migrate.

All saves carry a `version` field. Invalid saves are rejected,
never half-applied. Migration functions convert between versions.
*/

/** Persistence module entrypoint.

Public API lives in:
- src/persistence/schema.ts — Zod save schema + version constant
- src/persistence/storage.ts — serialize/deserialize + storage helpers (loadGame,
  saveGame, resetGame)

The rest of the package is a re-export barrel so consumers can import from
`../persistence/index.js`.
*/

export { SAVE_VERSION, type SaveFile } from './schema.js';
export { serialize, deserialize, loadGame, saveGame, resetGame } from './storage.js';
