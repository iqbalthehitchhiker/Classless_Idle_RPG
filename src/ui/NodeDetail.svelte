<script lang="ts">
  import { gameStore, dispatchAction } from './index.js';
  import { canPurchaseNode, checkRequirements } from '../core/index.js';
  import type { SkillNodeDef, SkillNodeEffect } from '../data/schemas.js';
  import { defaultConfig } from '../data/index.js';

  let { node = null }: { node: SkillNodeDef | null } = $props();

  let state = $derived($gameStore.state);
  let skillPoints = $derived(state.character.skillPoints);

  function formatEffect(effect: SkillNodeEffect): string {
    if (effect.kind === 'statBonus') {
      const statLabels: Record<string, string> = {
        maxHp: 'Max HP',
        attack: 'Attack',
        critChance: 'Crit Chance',
        attackRate: 'Attack Rate',
        critDamage: 'Crit Damage',
      };
      const label = statLabels[effect.stat] ?? effect.stat;
      if (effect.mode === 'percent') {
        return `+${(effect.value * 100).toFixed(0)}% ${label}`;
      }
      return `+${effect.value.toFixed(0)} ${label}`;
    }
    if (effect.kind === 'grantOnHitEffect') {
      const effectDef = defaultConfig.content.effects.get(effect.effectId);
      const name = effectDef?.name ?? effect.effectId;
      return `Grants ${name} on hit`;
    }
    return String(effect);
  }

  function getPrerequisiteNames(): string[] {
    const names: string[] = [];
    for (const prereqId of node?.prerequisites ?? []) {
      const n = defaultConfig.content.skillNodes.get(prereqId);
      names.push(n?.name ?? prereqId);
    }
    return names;
  }

  function getUnmetTexts(): string[] {
    if (!node) return [];
    const check = checkRequirements(state, node.requirements, defaultConfig);
    if (!check.ok) {
      return check.unmet.map((u) => u.text);
    }
    return [];
  }

  function getPurchaseCheck() {
    if (!node) return null;
    return canPurchaseNode(state, node.id, defaultConfig);
  }

  function purchase() {
    if (!node) return;
    const check = getPurchaseCheck();
    if (!check?.ok) return;
    dispatchAction({ type: 'purchaseNode', nodeId: node.id });
  }
</script>

<section class="panel">
  <h2>Node Detail</h2>
  {#if node}
    <div class="node-name">{node.name}</div>
    <div class="node-branch">Branch: {node.branch} &nbsp;|&nbsp; Cost: {node.cost}</div>
    <div class="node-effects">
      <strong>Effects:</strong>
      <ul>
        {#each node.effects as effect}
          <li>{formatEffect(effect)}</li>
        {/each}
      </ul>
    </div>
    {#if node.prerequisites.length > 0}
      <div class="node-prereqs">
        <strong>Prerequisites:</strong> {getPrerequisiteNames().join(', ')}
      </div>
    {/if}
    {#if getUnmetTexts().length > 0}
      <div class="node-requirements">
        <strong>Requirements not met:</strong>
        <ul>
          {#each getUnmetTexts() as text}
            <li>{text}</li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="node-points">Skill Points: {skillPoints}</div>
    {#if getPurchaseCheck()?.ok}
      <button
        class="buy-button"
        onclick={purchase}
        disabled={false}
      >
        Buy
      </button>
    {:else}
      {@const check = getPurchaseCheck()}
      <div class="buy-reason">{check && !check.ok ? check.reason : 'Cannot buy node'}</div>
    {/if}
  {:else}
    <div class="node-empty">Click a node in the skill tree to inspect it.</div>
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

  .node-name {
    font-size: var(--text-lg);
    color: var(--color-text);
    margin-bottom: var(--space-1);
  }

  .node-branch {
    font-size: var(--text-xs);
    color: var(--color-muted);
    margin-bottom: var(--space-2);
  }

  .node-effects {
    margin-bottom: var(--space-2);
  }

  .node-effects ul {
    margin: var(--space-1) 0 var(--space-2) 0;
    padding-left: var(--space-4);
  }

  .node-effects li {
    font-size: var(--text-xs);
    color: var(--color-text);
    margin-bottom: var(--space-1);
  }

  .node-prereqs {
    font-size: var(--text-xs);
    color: var(--color-text);
    margin-bottom: var(--space-2);
  }

  .node-requirements {
    font-size: var(--text-xs);
    color: var(--color-muted);
    margin-bottom: var(--space-2);
  }

  .node-requirements ul {
    margin: var(--space-1) 0 0 0;
    padding-left: var(--space-4);
  }

  .node-requirements li {
    margin-bottom: var(--space-1);
  }

  .node-points {
    font-size: var(--text-xs);
    color: var(--color-text);
    margin-bottom: var(--space-2);
  }

  .node-empty {
    font-size: var(--text-xs);
    color: var(--color-muted);
    padding: var(--space-3);
    text-align: center;
  }

  .buy-button {
    background: var(--color-accent);
    color: var(--color-void);
    border: none;
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    cursor: pointer;
    border-radius: var(--radius);
  }

  .buy-reason {
    font-size: var(--text-xs);
    color: var(--state-requirement-unmet);
    margin-top: var(--space-1);
  }
</style>