<script lang="ts">
  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone, summarizePossibilityFlags } from '$lib/rule-helpers';
  import type { ActiveLoreEntry, RuleEvaluationResult } from '$lib/types';

  export let lorePreview: ActiveLoreEntry[] = [];
  export let rulePreview: RuleEvaluationResult | null = null;
  export let error = '';
</script>

<aside class="preview-rail" data-testid="review-preview-rail">
  <section class="preview-section" data-testid="review-lore-preview">
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

  <section class="preview-section" data-testid="review-rules-preview">
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
      <div class="inline-state-summary">
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
    gap: 12px;
    align-content: start;
  }

  .preview-section {
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.9);
    box-shadow: 0 8px 18px rgba(65, 49, 35, 0.045);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .section-head strong,
  .inline-state-summary strong {
    color: #2f261d;
    font-size: 0.92rem;
  }

  .section-head span {
    font-size: 0.74rem;
    color: rgba(63, 47, 35, 0.6);
  }

  .preview-list {
    margin-top: 10px;
    display: grid;
    gap: 8px;
  }

  article {
    padding: 10px 11px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(121, 103, 81, 0.1);
  }

  article p,
  .inline-state-summary p,
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
    margin-top: 4px;
    font-size: 0.78rem;
  }

  .inline-state-summary {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed rgba(121, 103, 81, 0.24);
  }

  .inline-state-summary p,
  .empty {
    margin-top: 6px;
    color: rgba(63, 47, 35, 0.72);
    line-height: 1.55;
    font-size: 0.82rem;
  }

  .error {
    color: #b14d3b;
    font-size: 0.82rem;
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
