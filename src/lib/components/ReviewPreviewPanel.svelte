<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone, summarizePossibilityFlags } from '$lib/rule-helpers';
  import type { ReviewPreviewContext, ReviewPreviewSnapshot } from '$lib/types';
  import type { ReviewPreviewStatus } from '$lib/modules/review/workspace';

  export let status: ReviewPreviewStatus = 'stale';
  export let draftContext: ReviewPreviewContext | null = null;
  export let appliedContext: ReviewPreviewContext | null = null;
  export let sceneOptions: Array<{ id: string; title: string }> = [];
  export let characterOptions: Array<{ id: string; name: string }> = [];
  export let previewSnapshot: ReviewPreviewSnapshot | null = null;
  export let refreshError = '';

  const dispatch = createEventDispatcher<{
    refresh: void;
    updateContext: Partial<ReviewPreviewContext>;
  }>();

  const emptyOptionValue = '';

  $: statusCopy =
    status === 'stale'
      ? '预览已过期'
      : status === 'refreshing'
        ? '正在刷新预览'
        : status === 'error'
          ? '预览刷新失败'
          : '预览已就绪';

  $: displayedContext = draftContext ?? appliedContext;
  $: lorePreview = previewSnapshot?.lorePreview ?? [];
  $: rulePreview = previewSnapshot?.rulePreview ?? null;
  $: projectedOutcome = previewSnapshot?.projectedOutcome ?? null;
  $: explanations = previewSnapshot?.explanations ?? null;
  $: ruleSummaryText =
    explanations?.ruleSummary === '存在阻塞规则'
      ? '当前规则会阻止动作推进'
      : explanations?.ruleSummary ?? '尚未生成规则说明';
  $: stateSummary = rulePreview
    ? rulePreview.story_state.possibility_flags.length
      ? summarizePossibilityFlags(rulePreview.story_state.possibility_flags).join(' / ')
      : rulePreview.story_state.event_flags.join(' / ')
    : '';

  function updateContext(patch: Partial<ReviewPreviewContext>) {
    dispatch('updateContext', patch);
  }
</script>

<aside class="preview-rail" data-testid="review-preview-rail">
  <section class="preview-status-card">
    <div class="status-copy">
      <strong>{statusCopy}</strong>
      <p>
        审阅区会基于当前上下文自动刷新聚合预览；手动刷新可在失败或想重新确认时再次执行。
      </p>
    </div>
    <div class="context-form">
      <label>
        <span>预览场景</span>
        <select
          aria-label="预览场景"
          value={displayedContext?.sceneId ?? ''}
          on:change={(event) =>
            updateContext({ sceneId: (event.currentTarget as HTMLSelectElement).value })}
        >
          {#if !sceneOptions.length}
            <option value={displayedContext?.sceneId ?? ''}>{displayedContext?.sceneId ?? '暂无场景'}</option>
          {/if}
          {#each sceneOptions as scene}
            <option value={scene.id}>{scene.title}</option>
          {/each}
        </select>
      </label>

      <label>
        <span>事件类型</span>
        <input
          aria-label="事件类型"
          value={displayedContext?.eventKind ?? ''}
          on:change={(event) =>
            updateContext({ eventKind: (event.currentTarget as HTMLInputElement).value })}
          on:input={(event) =>
            updateContext({ eventKind: (event.currentTarget as HTMLInputElement).value })}
        />
      </label>

      <label class="context-text">
        <span>输入文本</span>
        <textarea
          aria-label="输入文本"
          rows="3"
          on:change={(event) =>
            updateContext({ inputText: (event.currentTarget as HTMLTextAreaElement).value })}
          on:input={(event) =>
            updateContext({ inputText: (event.currentTarget as HTMLTextAreaElement).value })}
        >{displayedContext?.inputText ?? ''}</textarea>
      </label>

      <div class="context-row">
        <label>
          <span>行动者</span>
          <select
            aria-label="行动者"
            value={displayedContext?.actorCharacterId ?? emptyOptionValue}
            on:change={(event) =>
              updateContext({
                actorCharacterId:
                  (event.currentTarget as HTMLSelectElement).value || null
              })}
          >
            <option value={emptyOptionValue}>自动选择</option>
            {#each characterOptions as character}
              <option value={character.id}>{character.name}</option>
            {/each}
          </select>
        </label>

        <label>
          <span>目标</span>
          <select
            aria-label="目标"
            value={displayedContext?.targetCharacterId ?? emptyOptionValue}
            on:change={(event) =>
              updateContext({
                targetCharacterId:
                  (event.currentTarget as HTMLSelectElement).value || null
              })}
          >
            <option value={emptyOptionValue}>自动选择</option>
            {#each characterOptions as character}
              <option value={character.id}>{character.name}</option>
            {/each}
          </select>
        </label>
      </div>
    </div>
    <button
      type="button"
      class="refresh-button"
      disabled={status === 'refreshing'}
      on:click={() => dispatch('refresh')}
    >
      刷新预览
    </button>
  </section>

  <section class="preview-section" data-testid="review-lore-preview">
    <div class="section-head">
      <strong>lore 预览</strong>
      <span>{lorePreview.length} 条</span>
    </div>

    <p class="summary">
      <strong>lore 说明</strong>
      {explanations?.loreSummary ?? '尚未生成 lore 说明'}
    </p>

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

    <p class="summary">
      <strong>规则说明</strong>
      {ruleSummaryText}
    </p>

    {#if rulePreview?.blocked}
      <p class="blocked">存在阻塞规则</p>
    {/if}

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
          {#if stateSummary}
            {stateSummary}
          {:else}
            暂无新的状态变化
          {/if}
        </p>
      </div>
    {/if}
  </section>

  <section class="preview-section" data-testid="review-outcome-preview">
    <div class="section-head">
      <strong>结果推演</strong>
      <span>{projectedOutcome?.blocked ? '阻塞' : projectedOutcome?.staysOnScene ? '停留' : '推进'}</span>
    </div>

    <p class="summary">
      <strong>结果说明</strong>
      {explanations?.outcomeSummary ?? '尚未生成结果说明'}
    </p>

    {#if projectedOutcome}
      {#if projectedOutcome.blocked}
        <p class="blocked">本次动作会被阻止</p>
      {/if}

      <div class="preview-list">
        <article>
          <p>
            {#if projectedOutcome.staysOnScene}
              停留在当前场景
            {:else if projectedOutcome.nextSceneTitle}
              推进至《{projectedOutcome.nextSceneTitle}》
            {:else if projectedOutcome.nextSceneId}
              推进至 {projectedOutcome.nextSceneId}
            {:else}
              当前上下文下不会推进到新场景
            {/if}
          </p>
          <span>
            {#if projectedOutcome.nextSceneSummary}
              {projectedOutcome.nextSceneSummary}
            {:else if projectedOutcome.blocked}
              当前动作会被阻止，不会产生新场景推进。
            {:else if projectedOutcome.staysOnScene}
              当前动作会停留在本场景内继续结算。
            {:else}
              当前没有额外的场景摘要。
            {/if}
          </span>
        </article>

        {#if projectedOutcome.candidateChoices.length}
          {#each projectedOutcome.candidateChoices as choice}
            <article>
              <p>{choice.label}</p>
              <span>{choice.nextSceneId}</span>
            </article>
          {/each}
        {/if}
      </div>
    {:else}
      <p class="empty">当前还没有可展示的结果推演。</p>
    {/if}
  </section>

  {#if status === 'error' && refreshError}
    <p class="error">{refreshError}</p>
  {/if}
</aside>

<style>
  .preview-rail {
    display: grid;
    gap: 12px;
    align-content: start;
    position: sticky;
    top: 12px;
  }

  .preview-status-card,
  .preview-section {
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.9);
    box-shadow: 0 8px 18px rgba(65, 49, 35, 0.045);
  }

  .preview-status-card {
    display: grid;
    gap: 12px;
  }

  .context-form {
    display: grid;
    gap: 10px;
  }

  .context-row {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  label {
    display: grid;
    gap: 6px;
  }

  label span {
    color: rgba(63, 47, 35, 0.7);
    font-size: 0.76rem;
  }

  input,
  textarea,
  select,
  button {
    font: inherit;
  }

  input,
  textarea,
  select {
    width: 100%;
    padding: 10px 11px;
    border-radius: 12px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(255, 255, 255, 0.86);
    color: #2f261d;
    box-sizing: border-box;
  }

  textarea {
    resize: vertical;
    min-height: 88px;
  }

  .status-copy strong,
  .section-head strong,
  .inline-state-summary strong {
    color: #2f261d;
    font-size: 0.92rem;
  }

  .status-copy p,
  .inline-state-summary p,
  .summary,
  .empty,
  .blocked,
  .error {
    margin: 6px 0 0;
    color: rgba(63, 47, 35, 0.72);
    line-height: 1.55;
    font-size: 0.82rem;
  }

  .summary strong {
    display: inline-block;
    margin-right: 6px;
    color: #2f261d;
  }

  .refresh-button {
    min-height: 42px;
    border-radius: 999px;
    border: none;
    background: #1f6a57;
    color: #f6f3eb;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .refresh-button:disabled {
    cursor: progress;
    opacity: 0.72;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
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

  article p {
    margin: 0;
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

  .blocked {
    color: #a56a12;
  }

  .error {
    color: #b14d3b;
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

  @media (max-width: 1120px) {
    .preview-rail {
      position: static;
      top: auto;
    }
  }

  @media (max-width: 720px) {
    .context-row {
      grid-template-columns: 1fr;
    }
  }
</style>
