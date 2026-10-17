<script lang="ts">
  import { gameStore, dispatchAction, setSpeed, setPaused, saveNow, resetAndClearError } from './ui/index.js';
  import { deriveStats, xpToNextLevel } from './core/index.js';
  import { defaultConfig } from './data/index.js';
  
  let showDebug = $state(false);
  let timeSinceLastSave = $state(0);
  let showResetConfirm = $state(false);
  
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
</script>

<main>
  <h1>Classless Idle RPG</h1>
  
  <!-- Error Banner (D20) -->
  {#if $gameStore.loadError !== null}
    <div class="error-banner">
      <strong>Save Error:</strong> {$gameStore.loadError}
      {#if showResetConfirm}
        <div style="margin-top: 0.5rem;">
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
    <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center;">
      <button onclick={handleSaveNow} disabled={$gameStore.loadError !== null}>Save now</button>
      {#if $gameStore.lastSavedAt !== null}
        <span style="font-size: 0.9rem;">Last saved: {timeSinceLastSave}s ago</span>
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
    <span style="margin-left: 1rem;">Cleared: [{$gameStore.state.clearedStages.join(', ') || 'none'}]</span>
    <span style="margin-left: 1rem;">Unlocked: [{$gameStore.state.unlockedStages.join(', ')}]</span>
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
        <div class="bar">
          <div class="bar-fill" style="width: {(char.xp / xpNeeded) * 100}%"></div>
        </div>
      </div>
      <div>
        HP: {currentHp.toFixed(0)} / {stats.maxHp.toFixed(0)}
        <div class="bar">
          <div class="bar-fill hp" style="width: {(currentHp / stats.maxHp) * 100}%"></div>
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
      {/if}
      
      <h3>Enemies</h3>
      {#each combat.enemies as enemy}
        {@const def = defaultConfig.content.enemies.get(enemy.defId)}
        <div class="enemy">
          <div>{def?.name ?? enemy.defId} - {enemy.hp.toFixed(0)} / {enemy.maxHp.toFixed(0)}</div>
          <div class="bar">
            <div class="bar-fill enemy-hp" style="width: {(enemy.hp / enemy.maxHp) * 100}%"></div>
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
    
    <div style="margin-top: 0.5rem;">
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
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem;
    color: #e0e0e0;
    background: #1a1a1a;
    min-height: 100vh;
  }
  
  h1 {
    color: #c8a86e;
    margin-bottom: 1rem;
  }
  
  .error-banner {
    padding: 1rem;
    background: #4a2020;
    border-left: 4px solid #e24a4a;
    margin-bottom: 1rem;
    border-radius: 4px;
  }
  
  .error-banner button {
    margin-top: 0.5rem;
    margin-right: 0.5rem;
    background: #e24a4a;
  }
  
  .error-banner button:hover {
    background: #f25a5a;
  }
  
  h2 {
    color: #c8a86e;
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
  }
  
  h3 {
    color: #a89968;
    font-size: 1rem;
    margin: 0.5rem 0 0.25rem 0;
  }
  
  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #252525;
    border-radius: 4px;
  }
  
  .status-banner {
    padding: 0.75rem;
    background: #2a2a2a;
    border-left: 4px solid #c8a86e;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .panel {
    background: #252525;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 4px;
  }
  
  .bar {
    width: 100%;
    height: 20px;
    background: #333;
    border-radius: 4px;
    overflow: hidden;
    margin: 0.25rem 0;
  }
  
  .bar-fill {
    height: 100%;
    background: #4a90e2;
    transition: width 0.2s;
  }
  
  .bar-fill.hp {
    background: #e24a4a;
  }
  
  .bar-fill.enemy-hp {
    background: #e2a54a;
  }
  
  .enemy {
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: #2a2a2a;
    border-radius: 4px;
  }
  
  .effects {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
  
  .badge {
    background: #3a3a3a;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  
  .log {
    font-family: monospace;
    font-size: 0.9rem;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .log div {
    padding: 0.25rem 0;
    border-bottom: 1px solid #333;
  }
  
  button {
    background: #3a3a3a;
    color: #e0e0e0;
    border: 1px solid #555;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #4a4a4a;
  }
  
  select {
    background: #3a3a3a;
    color: #e0e0e0;
    border: 1px solid #555;
    padding: 0.5rem;
    border-radius: 4px;
  }
  
  pre {
    font-size: 0.75rem;
    overflow-x: auto;
    background: #1a1a1a;
    padding: 1rem;
    border-radius: 4px;
    max-height: 500px;
    overflow-y: auto;
  }
  
  input[type="checkbox"] {
    margin-right: 0.5rem;
  }
</style>
