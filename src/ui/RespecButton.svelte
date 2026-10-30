<script lang="ts">
  import { gameStore, dispatchAction } from './index.js';
  import { canRespec } from '../core/index.js';

  let showConfirm = $state(false);

  let gameState = $derived($gameStore.state);
  let respecCheck = $derived(canRespec(gameState));
  let disabled = $derived(!respecCheck.ok);
  let reason = $derived(
    gameState.activeActivity !== null
      ? 'Stop combat to respec'
      : respecCheck.ok ? '' : respecCheck.reason,
  );

  function confirmRespec() {
    if (!respecCheck.ok) return;
    showConfirm = true;
  }

  function doRespec() {
    dispatchAction({ type: 'respec' });
    showConfirm = false;
  }

  function cancelRespec() {
    showConfirm = false;
  }
</script>

<section class="panel">
  <h2>Respec</h2>
  <button
    class="respec-button"
    onclick={confirmRespec}
    disabled={disabled}
    title={disabled ? reason : ''}
  >
    Respec
  </button>
  {#if disabled}
    <div class="respec-reason">{reason}</div>
  {/if}
  {#if showConfirm}
    <div class="respec-confirm">
      <strong>Reset all skill nodes?</strong> This will refund all skill points and clear your purchases.
      <div class="respec-actions">
        <button onclick={doRespec}>Yes, Respec</button>
        <button onclick={cancelRespec}>Cancel</button>
      </div>
    </div>
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

  .respec-button {
    background: var(--color-accent);
    color: var(--color-void);
    border: none;
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    cursor: pointer;
    border-radius: var(--radius);
  }

  .respec-button:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
  }

  .respec-reason {
    font-size: var(--text-xs);
    color: var(--state-requirement-unmet);
    margin-top: var(--space-1);
  }

  .respec-confirm {
    margin-top: var(--space-2);
    padding: var(--space-3);
    background: var(--color-raised);
    border-radius: var(--radius);
  }

  .respec-actions {
    margin-top: var(--space-2);
    display: flex;
    gap: var(--space-2);
  }

  .respec-actions button {
    background: var(--color-accent);
    color: var(--color-void);
    border: none;
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    cursor: pointer;
    border-radius: var(--radius);
    flex: 1;
  }
</style>