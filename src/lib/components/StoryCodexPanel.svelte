<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone } from '$lib/rule-helpers';
  import type { ActiveLoreEntry, ActiveRuleHit, SessionState, StoryCodex } from '$lib/types';

  export let codex: StoryCodex | null = null;
  export let session: SessionState | null = null;
  export let activeLore: ActiveLoreEntry[] = [];
  export let activeRules: ActiveRuleHit[] = [];

  const dispatch = createEventDispatcher<{ rewind: string }>();
  let activeTab: 'characters' | 'lore' | 'timeline' | 'choices' = 'characters';
</script>

<aside class="codex">
  <div class="codex-head">
    <div>
      <p class="eyebrow">Story Codex</p>
      <h3>世界侧栏</h3>
    </div>
    <p>{session?.visited_scenes.length ?? 0} 个场景已解锁</p>
  </div>

  <div class="tabs">
    <button type="button" class:active={activeTab === 'characters'} on:click={() => (activeTab = 'characters')}>人物</button>
    <button type="button" class:active={activeTab === 'lore'} on:click={() => (activeTab = 'lore')}>Lore</button>
    <button type="button" class:active={activeTab === 'timeline'} on:click={() => (activeTab = 'timeline')}>时间线</button>
    <button type="button" class:active={activeTab === 'choices'} on:click={() => (activeTab = 'choices')}>抉择</button>
  </div>

  {#if activeTab === 'characters'}
    <div class="list">
      {#each codex?.characters ?? [] as character}
        <article>
          <strong>{character.name}</strong>
          <span>{character.role}</span>
          <p>{character.summary}</p>
        </article>
      {/each}
    </div>
  {:else if activeTab === 'lore'}
    <div class="list">
      {#each activeRules as rule}
        <article>
          <strong>{rule.name}</strong>
          <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.priority}</span>
          <p>{rule.explanation}</p>
        </article>
      {/each}
      {#each activeLore as lore}
        <article>
          <strong>{lore.title}</strong>
          <span class={`tone-${loreLifecycleTone(lore.lifecycle_state)}`}>
            {loreSlotLabel(lore.slot)} · {lore.lifecycle_state}
          </span>
          <p>{lore.reason}</p>
        </article>
      {/each}
      {#each codex?.world_rules ?? [] as rule}
        <article>
          <strong>原始规则</strong>
          <p>{rule.description}</p>
        </article>
      {/each}
    </div>
  {:else if activeTab === 'timeline'}
    <div class="list">
      {#each codex?.timeline ?? [] as entry}
        <article>
          <strong>{entry.label}</strong>
          <p>{entry.summary}</p>
        </article>
      {/each}
    </div>
  {:else}
    <div class="list">
      <article>
        <strong>最近选择</strong>
        <p>{session?.major_choices.length ? session?.major_choices.join(' / ') : '还没有足够的决定。'}</p>
      </article>
      <article>
        <strong>已知事实</strong>
        <p>{session?.known_facts.length ? session?.known_facts.join('；') : '故事尚未给出新的事实。'}</p>
      </article>
      <article>
        <strong>可回溯节点</strong>
        <div class="checkpoint-list">
          {#each session?.available_checkpoints ?? [] as checkpoint}
            <button type="button" on:click={() => dispatch('rewind', checkpoint.checkpoint.id)}>
              {checkpoint.checkpoint.label}
            </button>
          {/each}
        </div>
      </article>
    </div>
  {/if}
</aside>

<style>
  .codex {
    display: grid;
    align-content: start;
    gap: 16px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(255, 243, 214, 0.1);
    background: rgba(14, 11, 9, 0.82);
    min-height: 100%;
  }

  .codex-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.68rem;
  }

  h3,
  .codex-head p {
    margin: 0;
  }

  h3 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.5rem;
  }

  .codex-head p {
    font-size: 0.82rem;
    color: rgba(255, 243, 214, 0.64);
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .tabs button,
  .checkpoint-list button {
    border: 1px solid rgba(255, 238, 207, 0.08);
    border-radius: 999px;
    background: rgba(255, 248, 230, 0.04);
    color: #f7e5bf;
    cursor: pointer;
    font: inherit;
  }

  .tabs button {
    min-height: 40px;
  }

  .tabs button.active {
    background: linear-gradient(135deg, rgba(204, 150, 70, 0.22), rgba(255, 229, 178, 0.12));
    border-color: rgba(255, 227, 170, 0.22);
  }

  .list {
    display: grid;
    gap: 12px;
  }

  article {
    padding: 16px;
    border-radius: 18px;
    background: rgba(28, 20, 15, 0.88);
    border: 1px solid rgba(255, 238, 207, 0.06);
  }

  article strong,
  article span,
  article p {
    display: block;
  }

  article span {
    margin-top: 4px;
    color: #f0cf8d;
    font-size: 0.82rem;
  }

  .tone-danger {
    color: #ffb7a5;
  }

  .tone-warning {
    color: #f4cf90;
  }

  .tone-accent,
  .tone-success {
    color: #bfe5db;
  }

  .tone-muted {
    color: rgba(255, 243, 214, 0.6);
  }

  article p {
    margin: 10px 0 0;
    line-height: 1.65;
    color: rgba(255, 243, 214, 0.72);
  }

  .checkpoint-list {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkpoint-list button {
    padding: 9px 12px;
  }
</style>
