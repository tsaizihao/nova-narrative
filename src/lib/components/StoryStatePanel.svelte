<script lang="ts">
  import { ruleBadgeTone, summarizePossibilityFlags } from '$lib/rule-helpers';
  import type { ActiveRuleHit, StoryState } from '$lib/types';

  export let storyState: StoryState;
  export let activeRules: ActiveRuleHit[] = [];
</script>

<aside class="state-panel">
  <div class="state-head">
    <div>
      <p class="eyebrow">Runtime</p>
      <h3>世界状态</h3>
    </div>
    <p>{storyState.visited_scenes.length} 个已访问场景</p>
  </div>

  <div class="list">
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
        {#each storyState.character_states as state}
          <span>{state.character_id}: {state.status_flags.length ? state.status_flags.join('、') : '稳定'}</span>
        {/each}
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
  </div>
</aside>

<style>
  .state-panel {
    display: grid;
    align-content: start;
    gap: 16px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(255, 243, 214, 0.1);
    background: rgba(14, 11, 9, 0.82);
    min-height: 100%;
  }

  .state-head {
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
  .state-head p {
    margin: 0;
  }

  h3 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.5rem;
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
  article p {
    display: block;
  }

  article p {
    margin: 10px 0 0;
    line-height: 1.65;
    color: rgba(255, 243, 214, 0.72);
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
    background: rgba(255, 248, 230, 0.05);
    color: rgba(255, 243, 214, 0.78);
    font-size: 0.78rem;
  }

  .tone-danger {
    background: rgba(169, 62, 44, 0.24);
  }

  .tone-warning {
    background: rgba(192, 130, 57, 0.24);
  }

  .tone-accent {
    background: rgba(62, 112, 129, 0.24);
  }

  .tone-muted {
    background: rgba(255, 248, 230, 0.06);
  }
</style>
