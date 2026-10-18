/**
 * Test helper: enters the boss phase via the challengeBoss action (D2/D22).
 *
 * The state must be eligible first (stage in clearedStages, or
 * wavesCleared >= stage.minWavesBeforeBoss); otherwise this throws so
 * misuse fails loudly instead of silently no-oping.
 */
import { dispatch } from '../../src/core/index.js';
import type { GameConfig, GameState } from '../../src/core/index.js';

export function enterBoss(state: GameState, config: GameConfig): GameState {
  const next = dispatch(state, { type: 'challengeBoss' }, config);
  if (next.combat?.phase.type !== 'boss') {
    throw new Error(
      'enterBoss: challengeBoss was rejected — state is not eligible for the boss (D22)',
    );
  }
  return next;
}
