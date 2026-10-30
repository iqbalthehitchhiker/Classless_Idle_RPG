<script lang="ts">
  import { gameStore, dispatchAction } from './index.js';
  import { defaultConfig } from '../data/index.js';
  import { mul, pow, round, sub } from '../core/index.js';

  let state = $derived($gameStore.state);
  let disciplines = $derived([...defaultConfig.content.disciplines.values()]);
  let curve = $derived(defaultConfig.content.proficiencyCurve);

  function getProficiency(disciplineId: string) {
    return state.proficiency[disciplineId] ?? { xp: 0, level: 1 };
  }

  function xpNeededForLevel(level: number): number {
    return round(mul(curve.baseXp, pow(curve.growthFactor, sub(level, 1))));
  }

  function isTrained(disciplineId: string): boolean {
    return state.activeActivity === 'training' && state.trainingDisciplineId === disciplineId;
  }

  function train(disciplineId: string) {
    dispatchAction({
      type: 'startActivity',
      activityId: 'training',
      params: { disciplineId },
    });
  }

  function stop() {
    dispatchAction({ type: 'stopActivity' });
  }
</script>

<section class="panel">
  <h2>Disciplines</h2>
  {#each disciplines as discipline}
    {@const prof = getProficiency(discipline.id)}
    {@const trained = isTrained(discipline.id)}
    {@const needed = xpNeededForLevel(prof.level)}
    <div class="discipline-row {trained ? 'trained' : ''}">
      <span class="discipline-name">{discipline.name}</span>
      <span class="discipline-level">Lv {prof.level}</span>
      <div class="discipline-bar">
        <span class="bar-label">{prof.xp} / {needed}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: {needed > 0 ? Math.min(100, (prof.xp / needed) * 100) : 100}%"></div>
        </div>
      </div>
      {#if trained}
        <button class="stop-button" onclick={stop}>Stop</button>
      {:else}
        <button class="train-button" onclick={() => train(discipline.id)}>Train</button>
      {/if}
    </div>
  {/each}
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

  .discipline-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .discipline-row.trained {
    background: var(--color-raised);
    padding: var(--space-1);
    border-radius: var(--radius);
  }

  .discipline-name {
    font-size: var(--text-sm);
    color: var(--color-text);
    min-width: var(--space-6);
    flex: 0 0 auto;
  }

  .discipline-level {
    font-size: var(--text-xs);
    color: var(--color-muted);
    min-width: var(--space-5);
    flex: 0 0 auto;
  }

  .discipline-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .bar-label {
    font-size: var(--text-xs);
    color: var(--color-text);
    white-space: nowrap;
    min-width: var(--space-6);
    flex: 0 0 auto;
  }

  .bar-track {
    background: var(--color-stone);
    border-radius: var(--radius);
    overflow: hidden;
    height: var(--bar-xp-height);
    flex: 1;
  }

  .bar-fill {
    height: 100%;
    background: var(--bar-xp-fill);
    transition: width 150ms;
  }

  .train-button,
  .stop-button {
    background: var(--color-accent);
    color: var(--color-void);
    border: none;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    cursor: pointer;
    border-radius: var(--radius);
  }

  .train-button:disabled,
  .stop-button:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
  }
</style>