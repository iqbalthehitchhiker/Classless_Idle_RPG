/**
 * Game state store with RAF-driven loop (M1-14) and persistence (M1-13).
 */

import { writable, type Writable } from 'svelte/store';
import { createInitialState, advance, dispatch, type GameState, type Action } from '../core/index.js';
import { defaultConfig } from '../data/index.js';
import { loadGame, saveGame, resetGame } from '../persistence/index.js';

interface GameStore {
  state: GameState;
  speed: number; // 1, 5, 20
  paused: boolean;
  loadError: string | null;
  lastSavedAt: number | null;
}

// Load on startup (D19, D20)
const loadResult = loadGame(defaultConfig);
let initialState: GameState;
let loadError: string | null = null;

if (!loadResult.ok) {
  // Corrupt save: show error banner, disable autosave until reset
  loadError = loadResult.error;
  initialState = createInitialState(Date.now(), defaultConfig);
} else {
  initialState = loadResult.state;
}

const storeData: GameStore = {
  state: initialState,
  speed: 1,
  paused: true,
  loadError,
  lastSavedAt: loadError === null ? Date.now() : null,
};

export const gameStore: Writable<GameStore> = writable(storeData);

let lastTimestamp: number | null = null;
let lastAutosaveAt = Date.now();
const AUTOSAVE_INTERVAL_MS = 10000; // 10 seconds

function performSave() {
  if (storeData.loadError !== null) {
    // Autosave disabled while error banner shows
    return;
  }
  
  saveGame(storeData.state);
  storeData.lastSavedAt = Date.now();
  gameStore.set(storeData);
}

function gameLoop(timestamp: number) {
  const current = storeData;
  
  if (!current.paused && lastTimestamp !== null) {
    const elapsed = (timestamp - lastTimestamp) / 1000; // convert to seconds
    const clampedElapsed = Math.min(elapsed, 0.25); // max 0.25s per frame
    
    const newState = advance(current.state, clampedElapsed * current.speed, defaultConfig);
    
    storeData.state = newState;
    gameStore.set(storeData);
    
    // Autosave every 10s (only if no load error)
    const now = Date.now();
    if (current.loadError === null && now - lastAutosaveAt >= AUTOSAVE_INTERVAL_MS) {
      performSave();
      lastAutosaveAt = now;
    }
  }
  
  lastTimestamp = timestamp;
  requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);

// Autosave on visibility change to hidden
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      performSave();
    }
  });
}

// Autosave on pagehide
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    performSave();
  });
}

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

export function saveNow() {
  performSave();
}

export function resetAndClearError() {
  const freshState = resetGame(defaultConfig);
  storeData.state = freshState;
  storeData.loadError = null;
  storeData.lastSavedAt = Date.now();
  gameStore.set(storeData);
  lastAutosaveAt = Date.now();
}
