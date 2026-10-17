/**
 * Capped event log (M1-11, NFR-009).
 *
 * All core events are appended through appendLog so the log never grows
 * beyond MAX_LOG_ENTRIES. Pure function: never mutates the input state.
 */
import { MAX_LOG_ENTRIES } from './types.js';
import type { GameState, LogEntry } from './types.js';

/**
 * Appends one entry and trims the log to the most recent MAX_LOG_ENTRIES.
 */
export function appendLog(state: GameState, entry: LogEntry): GameState {
  const entries = [...state.log, entry];
  return {
    ...state,
    log:
      entries.length > MAX_LOG_ENTRIES
        ? entries.slice(entries.length - MAX_LOG_ENTRIES)
        : entries,
  };
}
