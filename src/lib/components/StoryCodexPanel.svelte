<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone } from '$lib/rule-helpers';
  import type { ActiveLoreEntry, ActiveRuleHit, SessionState, StoryCodex } from '$lib/types';

  export let codex: StoryCodex | null = null;
  export let session: SessionState | null = null;
  export let activeLore: ActiveLoreEntry[] = [];
  export let activeRules: ActiveRuleHit[] = [];

  const dispatch = createEventDispatcher<{ rewind: string }>();
  let activeTab: 'characters' | 'lore' | 'timeline' | 'choices' = 'lore';
</script>

<aside class="rail-panel">
  <div class="rail-head">
    <div>
      <p class="eyebrow">World</p>
      <h3>世界侧栏</h3>
    </div>
    <p>{session?.visited_scenes.length ?? 0} 个场景</p>
  </div>

  <div class="tabs">
    <button type="button" class:active={activeTab === 'lore'} on:click={() => (activeTab = 'lore')}>Lore</button>
    <button type="button" class:active={activeTab === 'characters'} on:click={() => (activeTab = 'characters')}>人物</button>
    <button type="button" class:active={activeTab === 'timeline'} on:click={() => (activeTab = 'timeline')}>时间线</button>
    <button type="button" class:active={activeTab === 'choices'} on:click={() => (activeTab = 'choices')}>抉择</button>
  </div>

  {#if activeTab === 'characters'}
    <div class="rail-stack">
      {#each codex?.characters ?? [] as character}
        <article>
          <strong>{character.name}</strong>
          <span>{character.role}</span>
          <p>{character.summary}</p>
        </article>
      {/each}
    </div>
  {:else if activeTab === 'lore'}
    <div class="rail-stack">
      {#each activeLore as lore}
        <article>
          <strong>{lore.title}</strong>
          <span class={`tone-${loreLifecycleTone(lore.lifecycle_state)}`}>
            {loreSlotLabel(lore.slot)} · {lore.lifecycle_state}
          </span>
          <p>{lore.reason}</p>
        </article>
      {/each}
      {#each activeRules as rule}
        <article>
          <strong>{rule.name}</strong>
          <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.priority}</span>
          <p>{rule.explanation}</p>
        </article>
      {/each}
      {#if !activeLore.length && !activeRules.length}
        <p class="empty">这一轮还没有新的 lore 或规则摘要。</p>
      {/if}
    </div>
  {:else if activeTab === 'timeline'}
    <div class="rail-stack">
      {#each codex?.timeline ?? [] as entry}
        <article>
          <strong>{entry.label}</strong>
          <p>{entry.summary}</p>
        </article>
      {/each}
    </div>
  {:else}
    <div class="rail-stack">
      <article>
        <strong>最近选择</strong>
        <p>{session?.major_choices.length ? session.major_choices.join(' / ') : '还没有足够的决定。'}</p>
      </article>
      <article>
        <strong>已知事实</strong>
        <p>{session?.known_facts.length ? session.known_facts.join('；') : '故事尚未给出新的事实。'}</p>
      </article>
      <article>
        <strong>回溯节点</strong>
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
  .rail-panel {
    display: grid;
    gap: 14px;
    align-content: start;
    padding: 18px;
    border-radius: 24px;
    border: 1px solid var(--reader-border, rgba(255, 243, 214, 0.08));
    background: var(--reader-shell-surface, rgba(12, 11, 15, 0.88));
    box-shadow: var(--reader-shadow, 0 18px 36px rgba(70, 54, 39, 0.08));
  }

  .rail-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-end;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--reader-eyebrow, #91765d);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.68rem;
  }

  h3,
  .rail-head p,
  .empty {
    margin: 0;
  }

  h3 {
    color: var(--reader-title, #2f261d);
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.35rem;
  }

  .rail-head p,
  .empty {
    color: var(--reader-muted, rgba(63, 47, 35, 0.64));
    font-size: 0.8rem;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .tabs button,
  .checkpoint-list button {
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
    border-radius: 999px;
    background: var(--reader-card-surface, rgba(244, 236, 225, 0.82));
    color: var(--reader-title, #2f261d);
    cursor: pointer;
    font: inherit;
  }

  .tabs button {
    min-height: 36px;
    font-size: 0.82rem;
  }

  .tabs button.active {
    background: var(--reader-accent-soft, rgba(31, 106, 87, 0.14));
    border-color: rgba(31, 106, 87, 0.24);
    color: var(--reader-accent, #1f6a57);
  }

  .rail-stack {
    display: grid;
    gap: 10px;
  }

  article {
    padding: 14px;
    border-radius: 16px;
    background: var(--reader-card-surface, rgba(255, 248, 230, 0.05));
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
  }

  article strong,
  article span,
  article p {
    display: block;
  }

  article strong {
    color: var(--reader-title, #2f261d);
  }

  article span {
    margin-top: 4px;
    font-size: 0.78rem;
  }

  article p {
    margin: 8px 0 0;
    color: var(--reader-body, rgba(47, 38, 29, 0.9));
    line-height: 1.6;
    font-size: 0.86rem;
  }

  .tone-danger {
    color: var(--reader-danger, #b14d3b);
  }

  .tone-warning {
    color: var(--reader-warm-accent, #9b6d39);
  }

  .tone-accent,
  .tone-success {
    color: var(--reader-accent, #1f6a57);
  }

  .tone-muted {
    color: var(--reader-muted, rgba(63, 47, 35, 0.64));
  }

  .checkpoint-list {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkpoint-list button {
    min-height: 34px;
    padding: 0 12px;
    font-size: 0.8rem;
  }
</style>
