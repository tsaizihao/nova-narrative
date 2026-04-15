<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { ruleBadgeTone } from '$lib/rule-helpers';
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
            <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.priority}</span>
          </button>
        {/each}
      </div>

      <article class="editor">
        <div class="row">
          <label>
            <span>名称</span>
            <input
              value={draft.name}
              on:input={(event) =>
                updateDraft({ name: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <label>
            <span>优先级</span>
            <select
              value={draft.priority}
              on:change={(event) =>
                updateDraft({
                  priority: (event.currentTarget as HTMLSelectElement)
                    .value as RuleDefinition['priority']
                })}
            >
              <option value="hard_constraint">hard_constraint</option>
              <option value="soft_constraint">soft_constraint</option>
              <option value="consequence">consequence</option>
              <option value="narrative_gate">narrative_gate</option>
            </select>
          </label>
        </div>
        <label>
          <span>说明</span>
          <textarea
            rows="4"
            value={draft.explanation}
            on:input={(event) =>
              updateDraft({ explanation: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
        <label class="toggle">
          <span>启用</span>
          <input
            type="checkbox"
            checked={draft.enabled}
            on:change={(event) =>
              updateDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })}
          />
        </label>
        <div class="meta">
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
        <p class="state">{dirty ? '有未保存更改' : '已与当前项目同步'}</p>
        <div class="actions">
          <button
            type="button"
            class="primary"
            disabled={saveBusy}
            on:click={() => dispatch('save')}
          >
            保存更改
          </button>
          <button
            type="button"
            class="ghost"
            disabled={deleteBusy}
            on:click={() => dispatch('remove')}
          >
            删除规则
          </button>
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
  .meta p {
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
  .state,
  .meta p {
    font-size: 0.8rem;
  }

  .count {
    padding-top: 4px;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(210px, 0.4fr) minmax(0, 0.6fr);
    gap: 14px;
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
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(121, 103, 81, 0.12);
  }

  .row {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  label {
    display: grid;
    gap: 8px;
  }

  label span,
  .meta p {
    color: rgba(63, 47, 35, 0.82);
  }

  .toggle {
    align-items: center;
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

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
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
    color: #b14d3b;
  }

  .tone-warning {
    color: #a56a12;
  }

  .tone-accent {
    color: #1f6a57;
  }

  .tone-muted {
    color: rgba(63, 47, 35, 0.58);
  }

  @media (max-width: 960px) {
    .workspace,
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
