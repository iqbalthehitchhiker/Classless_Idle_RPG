<script lang="ts">
  import { gameStore } from './index.js';
  import { checkRequirements } from '../core/index.js';
  import { defaultConfig } from '../data/index.js';
  import type { SkillNodeDef } from '../data/schemas.js';

  let { onSelect = () => {} }: { onSelect: (nodeId: string) => void } = $props();

  const NODE_SCALE = 60; // mirrors --skill-node-scale token
  const NODE_SIZE = 24; // mirrors --skill-node-size token
  const LINE_WIDTH = 2; // mirrors --skill-line-width token

  let state = $derived($gameStore.state);
  let nodes = $derived([...defaultConfig.content.skillNodes.values()]);
  let nodeMap = $derived(new Map(nodes.map((n) => [n.id, n])));
  let purchased = $derived(new Set(state.purchasedNodes));

  function getNodeState(node: SkillNodeDef): 'owned' | 'locked' | 'requirement-unmet' | 'available' {
    if (purchased.has(node.id)) return 'owned';
    for (const prereqId of node.prerequisites) {
      if (!purchased.has(prereqId)) return 'locked';
    }
    const reqCheck = checkRequirements(state, node.requirements, defaultConfig);
    if (!reqCheck.ok) return 'requirement-unmet';
    return 'available';
  }

  function getBranchColor(branch: string): string {
    switch (branch) {
      case 'center': return 'var(--branch-center)';
      case 'berserker': return 'var(--branch-berserker)';
      case 'paladin': return 'var(--branch-paladin)';
      default: return 'var(--color-muted)';
    }
  }

  function getStateMarker(state: 'owned' | 'locked' | 'requirement-unmet' | 'available'): string {
    switch (state) {
      case 'owned': return '✓';
      case 'available': return '+';
      case 'locked': return 'L';
      case 'requirement-unmet': return 'X';
    }
  }

  function getViewBox(): string {
    const pad = 40;
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    let first = true;
    for (const node of nodes) {
      const x = node.pos.x * NODE_SCALE;
      const y = node.pos.y * NODE_SCALE;
      if (first) {
        minX = maxX = x;
        minY = maxY = y;
        first = false;
      } else {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }

  function handleNodeClick(nodeId: string) {
    onSelect(nodeId);
  }
</script>

<section class="panel">
  <h2>Skill Tree</h2>
  <div class="skill-tree-viewport">
    <svg viewBox={getViewBox()} class="skill-tree-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Connector lines (drawn first, below nodes) -->
      {#each nodes as node}
        {#each node.prerequisites as prereqId}
          {@const prereq = nodeMap.get(prereqId)}
          {#if prereq}
            <line
              x1={prereq.pos.x * NODE_SCALE}
              y1={prereq.pos.y * NODE_SCALE}
              x2={node.pos.x * NODE_SCALE}
              y2={node.pos.y * NODE_SCALE}
              stroke="var(--color-border)"
              stroke-width={LINE_WIDTH}
            />
          {/if}
        {/each}
      {/each}

      <!-- Nodes -->
      {#each nodes as node}
        {@const nodeState = getNodeState(node)}
        {@const branchColor = getBranchColor(node.branch)}
        <g
          class="skill-node"
          role="button"
          tabindex="0"
          aria-label={node.name}
          transform={`translate(${node.pos.x * NODE_SCALE}, ${node.pos.y * NODE_SCALE})`}
          onclick={() => handleNodeClick(node.id)}
          onkeydown={(e) => { if (e.key === 'Enter') handleNodeClick(node.id); }}
        >
          {#if nodeState === 'owned'}
            <circle r={NODE_SIZE / 2} fill={branchColor} stroke="var(--state-owned)" stroke-width={LINE_WIDTH * 2} />
          {:else if nodeState === 'available'}
            <circle r={NODE_SIZE / 2} fill="var(--color-panel)" stroke="var(--state-affordable)" stroke-width={LINE_WIDTH} />
          {:else if nodeState === 'locked'}
            <circle r={NODE_SIZE / 2} fill="var(--state-locked)" stroke="var(--state-locked)" stroke-width={LINE_WIDTH} />
          {:else if nodeState === 'requirement-unmet'}
            <circle r={NODE_SIZE / 2} fill="var(--state-requirement-unmet)" stroke="var(--state-requirement-unmet)" stroke-width={LINE_WIDTH} />
          {/if}
          <text
            x="0"
            y="4"
            text-anchor="middle"
            fill="var(--color-text)"
            font-size="var(--text-xs)"
            font-family="var(--font-body)"
            pointer-events="none"
          >
            {getStateMarker(nodeState)}
          </text>
          <text
            x="0"
            y={NODE_SIZE / 2 + 14}
            text-anchor="middle"
            fill="var(--color-muted)"
            font-size="var(--text-xs)"
            font-family="var(--font-body)"
            pointer-events="none"
          >
            {node.name}
          </text>
        </g>
      {/each}
    </svg>
  </div>
  <p class="skill-hint">Click a node to inspect it</p>
</section>

<style>
  .panel {
    background: var(--color-panel);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
    border-radius: var(--radius);
    flex: 1;
  }

  h2 {
    color: var(--color-accent);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-3) 0;
  }

  .skill-tree-viewport {
    overflow: auto;
    max-height: var(--skill-tree-viewport-height); /* PLACEHOLDER */
    border: var(--frame-flat);
    background: var(--color-void);
    border-radius: var(--radius);
    margin-bottom: var(--space-2);
  }

  .skill-tree-svg {
    display: block;
  }

  .skill-node {
    cursor: pointer;
  }

  .skill-node:hover {
    outline: var(--border-width-thick) solid var(--color-accent);
  }

  .skill-hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-muted);
  }
</style>