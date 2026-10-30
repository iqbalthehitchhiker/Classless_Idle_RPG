<script lang="ts">
  import { gameStore } from './index.js';
  import { defaultConfig } from '../data/index.js';
  import { deriveStats, xpToNextLevel } from '../core/index.js';

  let state = $derived($gameStore.state);
  let char = $derived(state.character);
  let stats = $derived(deriveStats(state, defaultConfig));
  let xpNeeded = $derived(xpToNextLevel(char.level, defaultConfig.levelCurve));
  let currentHp = $derived(state.combat?.playerHp ?? char.currentHp);
</script>

<section class="panel">
  <h2>Character</h2>
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
</section>

<style>
  .panel {
    background: var(--color-panel);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
    border-radius: var(--radius);
  }

  h2 {
    color: var(--color-accent);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-3) 0;
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

  .bar-xp .bar-fill {
    background: var(--bar-xp-fill);
  }
</style>