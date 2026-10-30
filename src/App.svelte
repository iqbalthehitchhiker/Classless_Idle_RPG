<script lang="ts">
  import { gameStore, dispatchAction, setSpeed, setPaused, saveNow, resetAndClearError } from './ui/index.js';
  import { canChallengeBoss } from './core/index.js';
  import { defaultConfig } from './data/index.js';
  import CharacterPanel from './ui/CharacterPanel.svelte';
  import SkillTree from './ui/SkillTree.svelte';
  import NodeDetail from './ui/NodeDetail.svelte';
  import RespecButton from './ui/RespecButton.svelte';
  import DisciplinePanel from './ui/DisciplinePanel.svelte';
  import StageSelector from './ui/StageSelector.svelte';
  
  let showDebug = $state(false);
  let selectedNodeId = $state<string | null>(null);
  let selectedNode = $derived(selectedNodeId ? defaultConfig.content.skillNodes.get(selectedNodeId) ?? null : null);
  let timeSinceLastSave = $state(0);
  let showResetConfirm = $state(false);
  let showResetSaveConfirm = $state(false);

  // Timers
  let realStartMs = performance.now();
  let showSplits = $state(false);
  let splits: Array<{ level: number; gameTimeMs: number }> = $state([]);
  let prevGameMs = $state(0);
  let prevRealMs = $state(0);
  let speedRatio = $state(0);
  let prevLevel = $state(0);
  let realTimeMs = $state(0);

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Track level splits and speed ratio from state changes
  $effect(() => {
    const state = $gameStore.state;
    const now = performance.now();
    const currentGameMs = state.elapsedMs;
    const currentLevel = state.character.level;

    // Record level split when level increases between consecutive states
    if (prevLevel > 0 && currentLevel > prevLevel) {
      splits = [...splits, { level: currentLevel, gameTimeMs: currentGameMs }];
    }
    prevLevel = currentLevel;

    // Speed ratio: game seconds per real second over the last second
    if (prevRealMs > 0 && now - prevRealMs >= 1000) {
      speedRatio = (currentGameMs - prevGameMs) / (now - prevRealMs);
      prevGameMs = currentGameMs;
      prevRealMs = now;
    } else if (prevRealMs === 0) {
      prevGameMs = currentGameMs;
      prevRealMs = now;
    }
  });

  // Real time wall clock since page load
  $effect(() => {
    const interval = setInterval(() => {
      realTimeMs = performance.now() - realStartMs;
    }, 100);
    return () => clearInterval(interval);
  });

  // Update "time since last save" every second
  $effect(() => {
    const interval = setInterval(() => {
      if ($gameStore.lastSavedAt !== null) {
        timeSinceLastSave = Math.floor((Date.now() - $gameStore.lastSavedAt) / 1000);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  });
  
  function startCombat(stageId: string) {
    dispatchAction({ type: 'startActivity', activityId: 'combat', params: { stageId } });
    setPaused(false);
  }
  
  function stopCombat() {
    dispatchAction({ type: 'stopActivity' });
  }
  
  function toggleAutoProgress() {
    const current = $gameStore.state.settings.autoProgress;
    dispatchAction({ type: 'setAutoProgress', enabled: !current });
  }
  
  function toggleDebug() {
    showDebug = !showDebug;
  }
  
  function handleSaveNow() {
    saveNow();
    timeSinceLastSave = 0;
  }
  
  function handleResetConfirm() {
    resetAndClearError();
    showResetConfirm = false;
    splits = [];
    prevLevel = 0;
    prevGameMs = 0;
    prevRealMs = 0;
    speedRatio = 0;
  }

  function handleResetSaveConfirm() {
    resetAndClearError();
    showResetSaveConfirm = false;
    splits = [];
    prevLevel = 0;
    prevGameMs = 0;
    prevRealMs = 0;
    speedRatio = 0;
  }
  
  function handleChallengeBoss() {
    dispatchAction({ type: 'challengeBoss' });
  }
  
  function getBossButtonDisabledReason(): string | null {
    if (!$gameStore.state.combat) return 'No active combat';
    if ($gameStore.state.combat.phase.type !== 'active') return 'Not in active phase';
    if (!canChallengeBoss($gameStore.state, defaultConfig)) {
      const stage = defaultConfig.content.stages.get($gameStore.state.combat.stageId);
      if (!stage) return 'Stage not found';
      const needed = stage.minWavesBeforeBoss - $gameStore.state.combat.wavesCleared;
      if (needed > 0) return `Clear ${needed} more waves`;
    }
    return null;
  }
</script>

<main>
  <h1>Classless Idle RPG</h1>
  
  <!-- Error Banner (D20) -->
  {#if $gameStore.loadError !== null}
    <div class="error-banner">
      <strong>Save Error:</strong> {$gameStore.loadError}
      {#if showResetConfirm}
        <div style="margin-top: var(--space-2);">
          <strong>Are you sure?</strong> This will delete the corrupted save and start a new game.
          <button onclick={handleResetConfirm}>Yes, Reset</button>
          <button onclick={() => showResetConfirm = false}>Cancel</button>
        </div>
      {:else}
        <button onclick={() => showResetConfirm = true}>Reset Game</button>
      {/if}
    </div>
  {/if}
  
  <!-- Speed Controls -->
  <div class="controls">
    <button onclick={() => { setSpeed(1); setPaused(false); }}>1x</button>
    <button onclick={() => { setSpeed(5); setPaused(false); }}>5x</button>
    <button onclick={() => { setSpeed(20); setPaused(false); }}>20x</button>
    <button onclick={() => setPaused(true)}>Pause</button>
    <span>Speed: {$gameStore.speed}x {$gameStore.paused ? '(PAUSED)' : ''}</span>
    
    <!-- Save controls -->
    <div style="margin-left: auto; display: flex; gap: var(--space-2); align-items: center;">
      <button onclick={handleSaveNow} disabled={$gameStore.loadError !== null}>Save now</button>
      {#if $gameStore.lastSavedAt !== null}
        <span style="font-size: var(--text-xs);">Last saved: {timeSinceLastSave}s ago</span>
      {/if}
      {#if showResetSaveConfirm}
        <span style="font-size: var(--text-xs); color: var(--state-requirement-unmet);">Delete your save and start over?</span>
        <button onclick={handleResetSaveConfirm} style="background: var(--state-requirement-unmet);">Yes</button>
        <button onclick={() => showResetSaveConfirm = false}>No</button>
      {:else}
        <button onclick={() => showResetSaveConfirm = true}>Reset save</button>
      {/if}
    </div>
  </div>
  
  <!-- Status Banner -->
  <div class="status-banner">
    {#if $gameStore.state.activeActivity === null}
      <strong>Idle</strong>
    {:else if $gameStore.state.combat}
      {#if $gameStore.state.combat.phase.type === 'recovering'}
        <strong>RECOVERING</strong> ({($gameStore.state.combat.phase.remainingMs / 1000).toFixed(1)}s)
      {:else if $gameStore.state.combat.phase.type === 'boss'}
        <strong>BOSS FIGHT</strong>
      {:else}
        <strong>Fighting</strong>
      {/if}
    {/if}
    <span style="margin-left: var(--space-4);">Cleared: [{$gameStore.state.clearedStages.join(', ') || 'none'}]</span>
    <span style="margin-left: var(--space-4);">Unlocked: [{$gameStore.state.unlockedStages.join(', ')}]</span>
  </div>

  <!-- Timers Row -->
  <div class="timers-row">
    <span class="timers-label">Game:</span>
    <span class="timers-value">{formatTime($gameStore.state.elapsedMs)}</span>
    <span class="timers-label">Real:</span>
    <span class="timers-value">{formatTime(realTimeMs)}</span>
    <span class="timers-label">Speed:</span>
    <span class="timers-value">{speedRatio.toFixed(1)}x</span>
    <button onclick={() => showSplits = !showSplits} class="timers-toggle">
      {showSplits ? '\u25BC' : '\u25B6'} Level splits
    </button>
  </div>

  {#if showSplits}
    <div class="splits-list">
      {#each splits as split}
        <div class="split-entry">Lv {split.level} at {formatTime(split.gameTimeMs)}</div>
      {/each}
    </div>
  {/if}

  <CharacterPanel />
  
  <div class="skill-tree-row">
    <SkillTree onSelect={(nodeId: string) => selectedNodeId = nodeId} />
    <NodeDetail node={selectedNode} />
  </div>
  
  <RespecButton />
  <DisciplinePanel />
  <StageSelector />
  
  <!-- Combat Panel -->
  {#if $gameStore.state.combat}
    {@const combat = $gameStore.state.combat}
    {@const stage = defaultConfig.content.stages.get(combat.stageId)}
    
    <section class="panel">
      <h2>Combat: {stage?.name ?? combat.stageId}</h2>
      
      {#if combat.phase.type === 'boss'}
        <div><strong>BOSS</strong></div>
      {:else}
        <div>Wave {combat.waveIndex + 1} / {stage?.waves.length ?? '?'}</div>
        <div>Waves cleared: {combat.wavesCleared} / {stage?.minWavesBeforeBoss ?? '?'}</div>
        {@const disabledReason = getBossButtonDisabledReason()}
        <button 
          onclick={handleChallengeBoss}
          disabled={disabledReason !== null}
          title={disabledReason ?? ''}
        >
          Challenge Boss {disabledReason ? `(${disabledReason})` : ''}
        </button>
      {/if}
      
      <h3>Enemies</h3>
      {#each combat.enemies as enemy}
        {@const def = defaultConfig.content.enemies.get(enemy.defId)}
        <div class="enemy">
          <div>{def?.name ?? enemy.defId}{combat.phase.type === 'boss' ? ' (BOSS)' : ''}</div>
          <div class="bar-row {combat.phase.type === 'boss' ? 'bar-boss-hp' : 'bar-enemy-hp'}">
            <span class="bar-label">BOSS: {enemy.hp.toFixed(0)} / {enemy.maxHp.toFixed(0)}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {(enemy.hp / enemy.maxHp) * 100}%"></div>
            </div>
          </div>
          {#if enemy.effects.length > 0}
            <div class="effects">
              {#each enemy.effects as effect}
                {@const effectDef = defaultConfig.content.effects.get(effect.effectId)}
                <span class="badge">{effectDef?.name ?? effect.effectId} ({(effect.remainingMs / 1000).toFixed(1)}s)</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      
      {#if combat.playerEffects.length > 0}
        <h3>Player Effects</h3>
        <div class="effects">
          {#each combat.playerEffects as effect}
            {@const effectDef = defaultConfig.content.effects.get(effect.effectId)}
            <span class="badge">{effectDef?.name ?? effect.effectId} ({(effect.remainingMs / 1000).toFixed(1)}s)</span>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
  
  <!-- Controls -->
  <section class="panel">
    <h2>Controls</h2>
    
    {#if $gameStore.state.activeActivity === null}
      <div>
        <label for="stageSelect">Stage:</label>
        <select id="stageSelect">
          {#each $gameStore.state.unlockedStages as stageId}
            {@const stage = defaultConfig.content.stages.get(stageId)}
            <option value={stageId}>{stage?.name ?? stageId}</option>
          {/each}
        </select>
        <button onclick={() => {
          const select = document.getElementById('stageSelect') as HTMLSelectElement;
          startCombat(select.value);
        }}>Start Combat</button>
      </div>
    {:else}
      <button onclick={stopCombat}>Stop</button>
    {/if}
    
    <div style="margin-top: var(--space-2);">
      <label>
        <input type="checkbox" checked={$gameStore.state.settings.autoProgress} onchange={toggleAutoProgress} />
        Auto-progress to next stage on boss kill
      </label>
    </div>
  </section>
  
  <!-- Event Feed -->
  <section class="panel">
    <h2>Events</h2>
    <div class="log">
      {#each $gameStore.state.log.slice(-10).reverse() as entry}
        <div>{(entry.tMs / 1000).toFixed(1)}s: {entry.detail}</div>
      {/each}
    </div>
  </section>
  
  <!-- Debug Panel -->
  <section class="panel">
    <button onclick={toggleDebug} style="width: 100%; text-align: left; background: transparent; border: none; padding: 0;">
      <h2 style="cursor: pointer;">
        Debug {showDebug ? '▼' : '▶'}
      </h2>
    </button>
    {#if showDebug}
      <pre>{JSON.stringify($gameStore.state, null, 2)}</pre>
    {/if}
  </section>
</main>

<style>
  main {
    font-family: var(--font-body);
    max-width: var(--layout-max-width);
    margin: 0 auto;
    padding: var(--space-6);
    color: var(--color-text);
    background: var(--color-void);
    min-height: 100vh;
  }
  
  h1 {
    color: var(--color-accent);
    margin-bottom: var(--space-4);
  }
  
  .error-banner {
    padding: var(--space-4);
    background: var(--color-panel);
    border-left: var(--border-width-thick) solid var(--state-requirement-unmet);
    margin-bottom: var(--space-4);
    border-radius: var(--radius);
  }
  
  .error-banner button {
    margin-top: var(--space-2);
    margin-right: var(--space-2);
    background: var(--state-requirement-unmet);
  }
  
  .error-banner button:hover {
    background: var(--color-muted);
  }
  
  h2 {
    color: var(--color-accent);
    font-size: var(--text-lg);
    margin-bottom: var(--space-3);
  }
  
  h3 {
    color: var(--color-muted);
    font-size: var(--text-base);
    margin: var(--space-3) 0 var(--space-2) 0;
  }
  
  .controls {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-4);
    padding: var(--space-4);
    background: var(--color-panel);
    border-radius: var(--radius);
  }
  
  .status-banner {
    padding: var(--space-3);
    background: var(--color-raised);
    border-left: var(--border-width-thick) solid var(--color-accent);
    margin-bottom: var(--space-4);
    font-size: var(--text-xs);
  }
  
  .panel {
    background: var(--color-panel);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
    border-radius: var(--radius);
  }
  
  .bar-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin: var(--space-1) 0;
  }
  
  .bar-label {
    font-size: var(--text-xs);
    color: var(--color-text);
    white-space: nowrap;
  }
  
  .bar-track {
    background: var(--color-stone);
    border-radius: var(--radius);
    overflow: hidden;
  }
  
  .bar-enemy-hp .bar-track {
    width: var(--bar-enemy-hp-width);
    height: var(--bar-enemy-hp-height);
  }

  .bar-fill {
    height: 100%;
    transition: width 150ms;
  }

  .bar-enemy-hp .bar-fill {
    background: var(--bar-enemy-hp-fill);
  }
  
  .enemy {
    margin: var(--space-3) 0;
    padding: var(--space-2);
    background: var(--color-raised);
    border-radius: var(--radius);
  }
  
  .effects {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-2);
  }
  
  .badge {
    background: var(--color-stone);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    font-size: var(--text-xs);
  }
  
  .log {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    max-height: var(--log-max-height);
    overflow-y: auto;
  }
  
  .log div {
    padding: var(--space-1) 0;
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .timers-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3);
    background: var(--color-panel);
    border: var(--frame-flat);
    border-radius: var(--radius);
    margin-bottom: var(--space-4);
    font-size: var(--text-xs);
  }

  .timers-label {
    color: var(--color-muted);
  }

  .timers-value {
    color: var(--color-text);
  }

  .timers-toggle {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    padding: 0;
    font-size: var(--text-xs);
    font-family: var(--font-body);
  }

  .timers-toggle:hover {
    color: var(--color-muted);
  }

  .splits-list {
    margin-top: var(--space-2);
    padding: var(--space-3);
    background: var(--color-raised);
    border: var(--frame-flat);
    border-radius: var(--radius);
  }

  .split-entry {
    color: var(--color-text);
    font-size: var(--text-xs);
    padding: var(--space-1) 0;
  }
  
  button {
    background: var(--color-stone);
    color: var(--color-text);
    border: var(--border-width) solid var(--color-border);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    cursor: pointer;
  }
  
  button:hover {
    background: var(--color-muted);
  }
  
  select {
    background: var(--color-stone);
    color: var(--color-text);
    border: var(--border-width) solid var(--color-border);
    padding: var(--space-2);
    border-radius: var(--radius);
  }
  
  pre {
    font-size: var(--text-xs);
    overflow-x: auto;
    background: var(--color-void);
    padding: var(--space-4);
    border-radius: var(--radius);
    max-height: var(--pre-max-height);
    overflow-y: auto;
  }
  
  input[type="checkbox"] {
    margin-right: var(--space-2);
  }

  .skill-tree-row {
    display: flex;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }


</style>