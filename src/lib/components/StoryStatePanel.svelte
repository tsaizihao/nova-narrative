<script lang="ts">
  import { ruleBadgeTone, summarizePossibilityFlags } from '$lib/rule-helpers';
  import type { ActiveRuleHit, StoryState } from '$lib/types';

  interface ReaderActivityItem {
    id: string;
    label: string;
    detail: string;
    tone: 'muted' | 'accent' | 'danger';
  }

  export let storyState: StoryState;
  export let activeRules: ActiveRuleHit[] = [];
  export let activityLog: ReaderActivityItem[] = [];
</script>

<section class="drawer-panel" data-tone="paper">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Runtime</p>
      <h3>状态与日志</h3>
    </div>
    <p>{storyState.visited_scenes.length} 个场景</p>
  </div>

  <div class="panel-stack">
    <article>
      <strong>事件标记</strong>
      <p>{storyState.event_flags.length ? storyState.event_flags.join(' / ') : '暂无事件旗标'}</p>
    </article>
    <article>
      <strong>可能性</strong>
      <p>
        {#if storyState.possibility_flags.length}
          {summarizePossibilityFlags(storyState.possibility_flags).join(' / ')}
        {:else}
          暂无可能性变化
        {/if}
      </p>
    </article>
    <article>
      <strong>角色状态</strong>
      <div class="chips">
        {#if storyState.character_states.length}
          {#each storyState.character_states as state}
            <span>{state.character_id}: {state.status_flags.length ? state.status_flags.join('、') : '稳定'}</span>
          {/each}
        {:else}
          <span>暂无角色状态变化</span>
        {/if}
      </div>
    </article>
    <article>
      <strong>最近规则命中</strong>
      <div class="chips">
        {#if activeRules.length}
          {#each activeRules as rule}
            <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.name}</span>
          {/each}
        {:else}
          <span>暂无规则命中</span>
        {/if}
      </div>
    </article>
    <article>
      <strong>最近动作</strong>
      <p>{activityLog.length ? activityLog.map((item) => `${item.label}：${item.detail}`).join(' / ') : '暂无最近动作'}</p>
    </article>
  </div>
</section>

<style>
  .drawer-panel {
    display: grid;
    gap: 14px;
    align-content: start;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(246, 238, 226, 0.94)),
      rgba(248, 243, 234, 0.96);
  }

  .panel-head {
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
  .panel-head p {
    margin: 0;
  }

  h3 {
    color: var(--reader-title, #2f261d);
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.35rem;
  }

  .panel-head p {
    color: var(--reader-muted, rgba(63, 47, 35, 0.64));
    font-size: 0.8rem;
  }

  .panel-stack {
    display: grid;
    gap: 10px;
  }

  article {
    padding: 12px;
    border-radius: 16px;
    background: rgba(255, 252, 246, 0.92);
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
  }

  article strong,
  article p {
    display: block;
  }

  article strong {
    color: var(--reader-title, #2f261d);
  }

  article p {
    margin: 8px 0 0;
    color: var(--reader-body, rgba(47, 38, 29, 0.9));
    line-height: 1.6;
    font-size: 0.86rem;
  }

  .chips {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chips span {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--reader-chip-surface, rgba(121, 103, 81, 0.08));
    color: var(--reader-body, rgba(47, 38, 29, 0.9));
    font-size: 0.78rem;
  }

  .tone-danger {
    background: rgba(177, 77, 59, 0.14);
    color: var(--reader-danger, #b14d3b);
  }

  .tone-warning {
    background: rgba(181, 135, 78, 0.14);
    color: var(--reader-warm-accent, #9b6d39);
  }

  .tone-accent {
    background: rgba(31, 106, 87, 0.14);
    color: var(--reader-accent, #1f6a57);
  }

  .tone-muted {
    background: var(--reader-chip-surface, rgba(121, 103, 81, 0.08));
    color: var(--reader-muted, rgba(63, 47, 35, 0.64));
  }
</style>
