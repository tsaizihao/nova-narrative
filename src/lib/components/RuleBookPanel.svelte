<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { ruleBadgeTone } from '$lib/rule-helpers';
  import type { RuleDefinition } from '$lib/types';

  export let rules: RuleDefinition[] = [];

  const dispatch = createEventDispatcher<{ save: RuleDefinition; remove: string }>();

  let drafts: RuleDefinition[] = [];
  let previousRules: RuleDefinition[] = [];
  let activeIndex = 0;

  function cloneRule(rule: RuleDefinition): RuleDefinition {
    return JSON.parse(JSON.stringify(rule)) as RuleDefinition;
  }

  $: if (rules !== previousRules) {
    drafts = rules.map(cloneRule);
    previousRules = rules;
    activeIndex = Math.min(activeIndex, Math.max(rules.length - 1, 0));
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Review</p>
      <h3>规则簿</h3>
    </div>
    <p>{rules.length} 条规则</p>
  </div>

  {#if drafts.length}
    <div class="workspace">
      <div class="entity-list">
        {#each drafts as rule, index}
          <button
            type="button"
            class:active={index === activeIndex}
            on:click={() => (activeIndex = index)}
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
            <input bind:value={drafts[activeIndex].name} />
          </label>
          <label>
            <span>优先级</span>
            <select bind:value={drafts[activeIndex].priority}>
              <option value="hard_constraint">hard_constraint</option>
              <option value="soft_constraint">soft_constraint</option>
              <option value="consequence">consequence</option>
              <option value="narrative_gate">narrative_gate</option>
            </select>
          </label>
        </div>
        <label>
          <span>说明</span>
          <textarea bind:value={drafts[activeIndex].explanation} rows="4"></textarea>
        </label>
        <label class="toggle">
          <span>启用</span>
          <input type="checkbox" bind:checked={drafts[activeIndex].enabled} />
        </label>
        <div class="meta">
          <p>条件：{drafts[activeIndex].conditions.map((condition) => `${condition.fact} ${condition.operator} ${condition.value}`).join(' / ') || '暂无条件'}</p>
          <p>效果：{drafts[activeIndex].effects.map((effect) => `${effect.key}=${effect.value}`).join(' / ') || '暂无效果'}</p>
        </div>
        <div class="actions">
          <button type="button" class="primary" on:click={() => dispatch('save', drafts[activeIndex])}>
            保存并刷新预览
          </button>
          <button type="button" class="ghost" on:click={() => dispatch('remove', drafts[activeIndex].id)}>
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
    gap: 16px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.94);
    box-shadow: 0 14px 28px rgba(65, 49, 35, 0.06);
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #91765d;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.68rem;
  }

  h3,
  .panel-head p,
  .empty {
    margin: 0;
  }

  h3 {
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.5rem;
  }

  .panel-head p,
  .empty {
    color: rgba(63, 47, 35, 0.66);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(200px, 0.42fr) minmax(0, 1fr);
    gap: 16px;
  }

  .entity-list {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  .entity-list button {
    display: grid;
    gap: 4px;
    padding: 14px 16px;
    text-align: left;
    border-radius: 18px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(255, 255, 255, 0.78);
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

  .entity-list span,
  .meta p {
    font-size: 0.82rem;
    margin: 0;
  }

  .editor {
    display: grid;
    gap: 12px;
    padding: 18px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.82);
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

  @media (max-width: 920px) {
    .workspace,
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
