<script lang="ts">
  import { gameStore, dispatchAction, setSpeed, setPaused, saveNow, resetAndClearError } from './ui/index.js';
  import { deriveStats, xpToNextLevel, canChallengeBoss } from './core/index.js';
  import { defaultConfig } from './data/index.js';
  
  let showDebug = $state(false);
  let timeSinceLastSave = $state(0);
  let showResetConfirm = $state(false);
  let showResetSaveConfirm = $state(false);
  
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
  }
  
  function handleResetSaveConfirm() {
    resetAndClearError();
    showResetSaveConfirm = false;
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
  
  <!-- Character Panel -->
  <section class="panel">
    <h2>Character</h2>
    {#if $gameStore.state}
      {@const char = $gameStore.state.character}
      {@const stats = deriveStats($gameStore.state, defaultConfig)}
      {@const xpNeeded = xpToNextLevel(char.level, defaultConfig.levelCurve)}
      {@const currentHp = $gameStore.state.combat?.playerHp ?? char.currentHp}
      
      <div>Level: {char.level} | Skill Points: {char.skillPoints}</div>
      <div>
        XP: {char.xp} / {xpNeeded}
        <div class="bar-row bar-xp">
          <span class="bar-label">{char.xp} / {xpNeeded}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: {(char.xp / xpNeeded) * 100}%"></div>
          </div>
        </div>
      </div>
      <div>
        HP: {currentHp.toFixed(0)} / {stats.maxHp.toFixed(0)}
        <div class="bar-row bar-player-hp">
          <span class="bar-label">{currentHp.toFixed(0)} / {stats.maxHp.toFixed(0)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: {(currentHp / stats.maxHp) * 100}%"></div>
          </div>
        </div>
      </div>
      <div>Attack: {stats.attack.toFixed(1)} | Rate: {stats.attackRate.toFixed(2)}/s</div>
      <div>Crit: {(stats.critChance * 100).toFixed(0)}% chance, {stats.critDamage.toFixed(1)}x damage</div>
    {/if}
  </section>
  
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
          <div>{def?.name ?? enemy.defId}</div>
          <div class="bar-row bar-enemy-hp">
            <span class="bar-label">{enemy.hp.toFixed(0)} / {enemy.maxHp.toFixed(0)}</span>
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
  
  .bar-player-hp .bar-track {
    width: var(--bar-player-hp-width);
    height: var(--bar-player-hp-height);
  }
  
  .bar-enemy-hp .bar-track {
    width: var(--bar-enemy-hp-width);
    height: var(--bar-enemy-hp-height);
  }

  .bar-xp .bar-track {
    width: var(--bar-xp-width);
    height: var(--bar-xp-height);
  }
  
  .bar-fill {
    height: 100%;
    transition: width 150ms;
  }
  
  .bar-player-hp .bar-fill {
    background: var(--bar-player-hp-fill);
  }
  
  .bar-enemy-hp .bar-fill {
    background: var(--bar-enemy-hp-fill);
  }

  .bar-xp .bar-fill {
    background: var(--bar-xp-fill);
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
</style>