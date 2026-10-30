<script lang="ts">
  import { gameStore, dispatchAction, setPaused } from './index.js';
  import { canStartStage } from '../core/index.js';
  import { defaultConfig } from '../data/index.js';

  let state = $derived($gameStore.state);
  let active = $derived(state.activeActivity !== null);

  function startStage(stageId: string) {
    dispatchAction({ type: 'startActivity', activityId: 'combat', params: { stageId } });
    setPaused(false);
  }

  function getStageStatus(stageId: string): 'ok' | string {
    return canStartStage(state, stageId, defaultConfig);
  }
</script>

<section class="panel">
  <h2>Stages</h2>
  {#if active}
    <p class="stage-active">An activity is running. Stop it to start a stage.</p>
  {:else}
    {#each state.unlockedStages as stageId}
      {@const stage = defaultConfig.content.stages.get(stageId)}
      {@const status = getStageStatus(stageId)}
      {#if status === 'ok'}
        <div class="stage-row">
          <span class="stage-name">{stage?.name ?? stageId}</span>
          <button class="start-button" onclick={() => startStage(stageId)}>Start</button>
        </div>
      {:else}
        <div class="stage-row disabled">
          <span class="stage-name">{stage?.name ?? stageId}</span>
          <span class="stage-reason">{status}</span>
        </div>
      {/if}
    {/each}
  {/if}
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

  .stage-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .stage-row.disabled {
    opacity: 0.6;
  }

  .stage-name {
    font-size: var(--text-sm);
    color: var(--color-text);
    flex: 1;
  }

  .stage-reason {
    font-size: var(--text-xs);
    color: var(--color-muted);
  }

  .start-button {
    background: var(--color-accent);
    color: var(--color-void);
    border: none;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    cursor: pointer;
    border-radius: var(--radius);
  }

  .start-button:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
  }

  .stage-active {
    font-size: var(--text-xs);
    color: var(--color-muted);
    margin: 0;
  }
</style>