/**
 * Static activity registry (M1-12 refactor).
 *
 * All activities are defined here as a constant object, avoiding mutable state.
 */

import type { Activity } from './activity.js';
import { combatActivity } from './combat/activity.js';

export const activities = {
  combat: combatActivity,
} as const;

/**
 * Get an activity by ID with proper typing.
 */
export function getActivity(id: string): Activity | undefined {
  return activities[id as keyof typeof activities];
}
