<script lang="ts">
  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone, summarizePossibilityFlags } from '$lib/rule-helpers';
  import type { ActiveLoreEntry, RuleEvaluationResult } from '$lib/types';

  export let lorePreview: ActiveLoreEntry[] = [];
  export let rulePreview: RuleEvaluationResult | null = null;
  export let error = '';
</script>

<aside class="preview-rail">
  <section class="preview-section">
    <div class="section-head">
      <strong>lore 预览</strong>
      <span>{lorePreview.length} 条</span>
    </div>

    <div class="preview-list">
      {#if lorePreview.length}
        {#each lorePreview as lore}
          <article>
            <p>{lore.title}</p>
            <span class={`tone-${loreLifecycleTone(lore.lifecycle_state)}`}>
              {loreSlotLabel(lore.slot)} · {lore.reason}
            </span>
          </article>
        {/each}
      {:else}
        <p class="empty">当前场景还没有激活 lore。</p>
      {/if}
    </div>
  </section>

  <section class="preview-section">
    <div class="section-head">
      <strong>规则预览</strong>
      <span>{rulePreview?.active_rules.length ?? 0} 条</span>
    </div>

    <div class="preview-list">
      {#if rulePreview?.active_rules.length}
        {#each rulePreview.active_rules as rule}
          <article>
            <p>{rule.name}</p>
            <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.explanation}</span>
          </article>
        {/each}
      {:else}
        <p class="empty">当前输入还没有触发新的规则命中。</p>
      {/if}
    </div>

    {#if rulePreview}
      <div class="state-preview">
        <strong>预测状态</strong>
        <p>
          {#if rulePreview.story_state.possibility_flags.length}
            {summarizePossibilityFlags(rulePreview.story_state.possibility_flags).join(' / ')}
          {:else if rulePreview.story_state.event_flags.length}
            {rulePreview.story_state.event_flags.join(' / ')}
          {:else}
            暂无新的状态变化
          {/if}
        </p>
      </div>
    {/if}
  </section>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</aside>

<style>
  .preview-rail {
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .preview-section,
  .state-preview {
    padding: 20px;
    border-radius: 22px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.94);
    box-shadow: 0 14px 28px rgba(65, 49, 35, 0.06);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .section-head strong,
  .state-preview strong {
    color: #2f261d;
    font-size: 1rem;
  }

  .section-head span {
    font-size: 0.78rem;
    color: rgba(63, 47, 35, 0.6);
  }

  .preview-list {
    margin-top: 14px;
    display: grid;
    gap: 10px;
  }

  article {
    padding: 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(121, 103, 81, 0.1);
  }

  article p,
  .state-preview p,
  .empty,
  .error {
    margin: 0;
  }

  article p {
    color: #2f261d;
    font-weight: 600;
  }

  article span {
    display: block;
    margin-top: 6px;
    font-size: 0.82rem;
  }

  .state-preview p,
  .empty {
    margin-top: 10px;
    color: rgba(63, 47, 35, 0.72);
    line-height: 1.65;
  }

  .error {
    color: #b14d3b;
    font-size: 0.88rem;
  }

  .tone-danger {
    color: #b14d3b;
  }

  .tone-warning {
    color: #a56a12;
  }

  .tone-accent,
  .tone-success {
    color: #1f6a57;
  }

  .tone-muted {
    color: rgba(63, 47, 35, 0.58);
  }
</style>
