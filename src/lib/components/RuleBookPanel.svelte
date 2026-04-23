<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { ruleBadgeTone, rulePriorityLabel } from '$lib/rule-helpers';
  import type { RuleDefinition } from '$lib/types';

  export let rules: RuleDefinition[] = [];
  export let activeId: string | null = null;
  export let draft: RuleDefinition | null = null;
  export let dirty = false;
  export let saveBusy = false;
  export let deleteBusy = false;

  const dispatch = createEventDispatcher<{
    select: string;
    change: RuleDefinition;
    save: void;
    remove: void;
  }>();

  function updateDraft(patch: Partial<RuleDefinition>) {
    if (!draft) return;

    dispatch('change', {
      ...draft,
      ...patch
    });
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Editor</p>
      <h3>规则</h3>
    </div>
    <p class="count">{rules.length} 条规则</p>
  </div>

  {#if rules.length && draft}
    <div class="workspace">
      <div class="entity-list">
        {#each rules as rule}
          <button
            type="button"
            class:active={rule.id === activeId}
            on:click={() => dispatch('select', rule.id)}
          >
            <strong>{rule.name}</strong>
            <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rulePriorityLabel(rule.priority)}</span>
          </button>
        {/each}
      </div>

      <article class="editor">
        <header class="document-head" data-testid="rule-document-head">
          <div class="document-meta">
            <span class="type-chip">规则</span>
            <span class={`meta-chip tone-${ruleBadgeTone(draft.priority)}`}>
              {rulePriorityLabel(draft.priority)}
            </span>
          </div>

          <div class="document-title-row">
            <div class="document-copy">
              <h3>{draft.name || '未命名规则'}</h3>
              <p class="document-note">
                {draft.explanation || '补充规则说明，帮助审阅时快速判断意图。'}
              </p>
            </div>

            <label class="state-toggle" data-testid="rule-enabled-row">
              <span>状态</span>
              <span class="toggle-copy">启用规则</span>
              <input
                aria-label="启用规则"
                type="checkbox"
                checked={draft.enabled}
                on:change={(event) =>
                  updateDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })}
              />
            </label>
          </div>

          <div class="document-attributes" data-testid="rule-attribute-row">
            <label class="attribute-field">
              <span>优先级</span>
              <select
                value={draft.priority}
                on:change={(event) =>
                  updateDraft({
                    priority: (event.currentTarget as HTMLSelectElement)
                      .value as RuleDefinition['priority']
                  })}
              >
                <option value="hard_constraint">{rulePriorityLabel('hard_constraint')}</option>
                <option value="soft_constraint">{rulePriorityLabel('soft_constraint')}</option>
                <option value="consequence">{rulePriorityLabel('consequence')}</option>
                <option value="narrative_gate">{rulePriorityLabel('narrative_gate')}</option>
              </select>
            </label>
          </div>
        </header>
        <label class="primary-field" data-testid="rule-name-field">
          <span>名称</span>
          <input
            value={draft.name}
            on:input={(event) =>
              updateDraft({ name: (event.currentTarget as HTMLInputElement).value })}
          />
        </label>
        <label>
          <span>说明</span>
          <textarea
            rows="4"
            value={draft.explanation}
            on:input={(event) =>
              updateDraft({ explanation: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
        <div class="meta-sheet">
          <p>
            条件：
            {draft.conditions
              .map((condition) => `${condition.fact} ${condition.operator} ${condition.value}`)
              .join(' / ') || '暂无条件'}
          </p>
          <p>
            效果：
            {draft.effects.map((effect) => `${effect.key}=${effect.value}`).join(' / ') ||
              '暂无效果'}
          </p>
        </div>
        <div class="editor-footer" data-testid="rule-editor-footer">
          <p class="state">{dirty ? '有未保存更改' : '已与当前项目同步'}</p>
          <div class="actions">
            <button
              type="button"
              class="ghost"
              disabled={deleteBusy}
              on:click={() => dispatch('remove')}
            >
              删除规则
            </button>
            <button
              type="button"
              class="primary"
              disabled={saveBusy}
              on:click={() => dispatch('save')}
            >
              保存更改
            </button>
          </div>
        </div>
      </article>
    </div>
  {:else}
    <p class="empty">当前没有可编辑的规则。</p>
  {/if}
</section>

<style>
  .panel {
    display: grid;
    gap: 14px;
    padding: 20px;
    border-radius: 20px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(248, 243, 234, 0.9);
    box-shadow: 0 10px 22px rgba(65, 49, 35, 0.05);
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0 0 6px;
    color: rgba(63, 47, 35, 0.52);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.64rem;
  }

  h3,
  .count,
  .empty,
  .state,
  .meta-sheet p {
    margin: 0;
  }

  h3 {
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.32rem;
  }

  .count,
  .empty,
  .state {
    color: rgba(63, 47, 35, 0.58);
  }

  .count,
  .state {
    font-size: 0.8rem;
  }

  .count {
    padding-top: 4px;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(210px, 0.4fr) minmax(0, 0.6fr);
    gap: 14px;
    align-items: start;
  }

  .entity-list {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .entity-list button {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    text-align: left;
    border-radius: 14px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(255, 255, 255, 0.74);
    font: inherit;
    cursor: pointer;
  }

  .entity-list button.active {
    border-color: rgba(31, 106, 87, 0.24);
    background: rgba(31, 106, 87, 0.08);
  }

  .entity-list strong {
    color: #2f261d;
  }

  .entity-list span {
    font-size: 0.82rem;
  }

  .editor {
    display: grid;
    gap: 24px;
    align-content: start;
    padding: 24px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(121, 103, 81, 0.16);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  .document-head {
    display: grid;
    gap: 12px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(121, 103, 81, 0.14);
  }

  .document-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .type-chip,
  .meta-chip {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(121, 103, 81, 0.08);
    color: rgba(63, 47, 35, 0.72);
    font-size: 0.76rem;
    letter-spacing: 0.04em;
  }

  .document-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .document-copy {
    display: grid;
    gap: 6px;
  }

  .document-note {
    margin: 0;
    color: rgba(63, 47, 35, 0.62);
    font-size: 0.86rem;
  }

  .state-toggle {
    display: flex;
    flex-wrap: wrap;
    min-height: 38px;
    padding: 0;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .toggle-copy {
    color: rgba(63, 47, 35, 0.76);
  }

  .document-attributes {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: end;
  }

  .attribute-field {
    inline-size: min(280px, 100%);
  }

  .primary-field input {
    font-size: 1.02rem;
  }

  label {
    display: grid;
    gap: 8px;
  }

  label span,
  .meta-sheet p {
    color: rgba(63, 47, 35, 0.82);
    font-size: 0.82rem;
  }

  .meta-sheet {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px dashed rgba(121, 103, 81, 0.24);
    background: rgba(248, 243, 234, 0.62);
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
    border-radius: 14px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(250, 246, 239, 0.92);
    color: #2f261d;
    padding: 12px 14px;
  }

  .state-toggle input {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #1f6a57;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 14px;
    border-top: 1px solid rgba(121, 103, 81, 0.12);
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .primary,
  .ghost {
    min-height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    border: none;
    cursor: pointer;
  }

  .primary {
    background: #1f6a57;
    color: #f6f3eb;
    font-weight: 700;
  }

  .ghost {
    background: rgba(121, 103, 81, 0.08);
    color: #5f4f3e;
  }

  .primary:disabled,
  .ghost:disabled {
    cursor: progress;
    opacity: 0.72;
  }

  .tone-danger {
    color: #8f3f30;
    background: rgba(177, 77, 59, 0.12);
  }

  .tone-warning {
    color: #8b5a10;
    background: rgba(165, 106, 18, 0.12);
  }

  .tone-accent {
    color: #1f6a57;
    background: rgba(31, 106, 87, 0.14);
  }

  .tone-muted {
    color: rgba(63, 47, 35, 0.68);
    background: rgba(121, 103, 81, 0.1);
  }

  @media (max-width: 960px) {
    .workspace {
      grid-template-columns: 1fr;
    }
  }
</style>
