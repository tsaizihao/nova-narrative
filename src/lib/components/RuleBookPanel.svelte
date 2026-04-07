<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { ruleBadgeTone } from '$lib/rule-helpers';
  import type { RuleDefinition } from '$lib/types';

  export let rules: RuleDefinition[] = [];

  const dispatch = createEventDispatcher<{ save: RuleDefinition; remove: string }>();

  let drafts: RuleDefinition[] = [];
  let previousRules: RuleDefinition[] = [];

  function cloneRule(rule: RuleDefinition): RuleDefinition {
    return JSON.parse(JSON.stringify(rule)) as RuleDefinition;
  }

  $: if (rules !== previousRules) {
    drafts = rules.map(cloneRule);
    previousRules = rules;
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

  <div class="list">
    {#each drafts as rule, index}
      <article>
        <div class="heading">
          <strong>{rule.name}</strong>
          <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.priority}</span>
        </div>
        <div class="row">
          <label>
            <span>名称</span>
            <input bind:value={drafts[index].name} />
          </label>
          <label>
            <span>优先级</span>
            <select bind:value={drafts[index].priority}>
              <option value="hard_constraint">hard_constraint</option>
              <option value="soft_constraint">soft_constraint</option>
              <option value="consequence">consequence</option>
              <option value="narrative_gate">narrative_gate</option>
            </select>
          </label>
        </div>
        <label>
          <span>说明</span>
          <textarea bind:value={drafts[index].explanation} rows="3"></textarea>
        </label>
        <label class="toggle">
          <span>启用</span>
          <input type="checkbox" bind:checked={drafts[index].enabled} />
        </label>
        <div class="meta">
          <p>条件：{drafts[index].conditions.map((condition) => `${condition.fact} ${condition.operator} ${condition.value}`).join(' / ')}</p>
          <p>效果：{drafts[index].effects.map((effect) => `${effect.key}=${effect.value}`).join(' / ')}</p>
        </div>
        <div class="actions">
          <button type="button" on:click={() => dispatch('save', drafts[index])}>保存规则</button>
          <button type="button" class="ghost" on:click={() => dispatch('remove', drafts[index].id)}>
            删除
          </button>
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .panel {
    display: grid;
    gap: 16px;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(255, 243, 214, 0.1);
    background: rgba(14, 11, 9, 0.82);
  }

  .panel-head {
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
  .panel-head p {
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
    display: grid;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background: rgba(28, 20, 15, 0.88);
    border: 1px solid rgba(255, 238, 207, 0.06);
  }

  .heading,
  .actions {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
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

  .toggle {
    align-items: center;
  }

  span,
  .meta p {
    font-size: 0.82rem;
    color: rgba(255, 243, 214, 0.74);
    margin: 0;
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
    border: 1px solid rgba(255, 238, 207, 0.1);
    background: rgba(15, 11, 9, 0.92);
    color: #fff4dd;
    padding: 12px 14px;
  }

  button {
    min-height: 42px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(255, 227, 170, 0.22);
    background: linear-gradient(135deg, rgba(204, 150, 70, 0.22), rgba(255, 229, 178, 0.12));
    color: #fff4dd;
    cursor: pointer;
  }

  .ghost {
    background: rgba(255, 248, 230, 0.04);
    border-color: rgba(255, 238, 207, 0.08);
  }

  .tone-danger,
  .tone-warning,
  .tone-accent,
  .tone-muted {
    padding: 6px 10px;
    border-radius: 999px;
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
