/**
 * Game state store with RAF-driven loop (M1-14).
 */

import { writable, type Writable } from 'svelte/store';
import { createInitialState, advance, dispatch, type GameState, type Action } from '../core/index.js';
import { defaultConfig } from '../data/index.js';

interface GameStore {
  state: GameState;
  speed: number; // 1, 5, 20
  paused: boolean;
}

const initialState = createInitialState(Date.now(), defaultConfig);

const storeData: GameStore = {
  state: initialState,
  speed: 1,
  paused: true,
};

export const gameStore: Writable<GameStore> = writable(storeData);

let lastTimestamp: number | null = null;

function gameLoop(timestamp: number) {
  const current = storeData;
  
  if (!current.paused && lastTimestamp !== null) {
    const elapsed = (timestamp - lastTimestamp) / 1000; // convert to seconds
    const clampedElapsed = Math.min(elapsed, 0.25); // max 0.25s per frame
    
    const newState = advance(current.state, clampedElapsed * current.speed, defaultConfig);
    
    storeData.state = newState;
    gameStore.set(storeData);
  }
  
  lastTimestamp = timestamp;
  requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);

export function dispatchAction(action: Action) {
  const current = storeData;
  const newState = dispatch(current.state, action, defaultConfig);
  storeData.state = newState;
  gameStore.set(storeData);
}

export function setSpeed(speed: number) {
  storeData.speed = speed;
  gameStore.set(storeData);
}

export function setPaused(paused: boolean) {
  storeData.paused = paused;
  if (paused) {
    lastTimestamp = null;
  }
  gameStore.set(storeData);
}
