/**
 * Activity framework (M1-12).
 *
 * Defines the generic Activity interface.
 * Activities are independent game modes (combat, training, etc.) that can be
 * started, advanced, and stopped through a unified interface.
 */

import type { GameConfig, GameState } from './types.js';

// ---------------------------------------------------------------------------
// Activity Interface
// ---------------------------------------------------------------------------

export interface Activity {
  readonly id: string;

  /**
   * Check if the activity can start given the current state and parameters.
   * @returns 'ok' if the activity can start, or a reason string if it cannot.
   */
  canStart(
    state: GameState,
    config: GameConfig,
    params: Record<string, unknown>,
  ): 'ok' | string;

  /**
   * Initialize the activity with the given parameters.
   * Returns updated state with the activity started.
   */
  start(
    state: GameState,
    config: GameConfig,
    params: Record<string, unknown>,
  ): GameState;

  /**
   * Advance the activity by the given time delta.
   * Returns updated state after the time step.
   */
  advance(
    state: GameState,
    dtMs: number,
    config: GameConfig,
  ): GameState;

  /**
   * Stop the activity, preserving earned progress (XP, level, unlocks, etc.).
   * Clears runtime state (combat state) but keeps persistent progress.
   */
  stop(state: GameState): GameState;
}
