<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { loreSlotLabel } from '$lib/rule-helpers';
  import type { WorldBookEntry } from '$lib/types';

  export let entries: WorldBookEntry[] = [];

  const dispatch = createEventDispatcher<{ save: WorldBookEntry; remove: string }>();

  let drafts: WorldBookEntry[] = [];
  let previousEntries: WorldBookEntry[] = [];

  function cloneEntry(entry: WorldBookEntry): WorldBookEntry {
    return JSON.parse(JSON.stringify(entry)) as WorldBookEntry;
  }

  $: if (entries !== previousEntries) {
    drafts = entries.map(cloneEntry);
    previousEntries = entries;
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Review</p>
      <h3>世界书</h3>
    </div>
    <p>{entries.length} 条 lore</p>
  </div>

  <div class="list">
    {#each drafts as entry, index}
      <article>
        <label>
          <span>标题</span>
          <input bind:value={drafts[index].title} />
        </label>
        <div class="row">
          <label>
            <span>插槽</span>
            <select bind:value={drafts[index].insertion_mode}>
              <option value="scene_prelude">场景前奏</option>
              <option value="rules_guard">规则守卫</option>
              <option value="codex_only">阅读侧栏</option>
            </select>
          </label>
          <label class="toggle">
            <span>启用</span>
            <input type="checkbox" bind:checked={drafts[index].enabled} />
          </label>
        </div>
        <label>
          <span>内容</span>
          <textarea bind:value={drafts[index].content} rows="3"></textarea>
        </label>
        <p class="meta">
          {drafts[index].source} · {loreSlotLabel(drafts[index].insertion_mode)}
        </p>
        <div class="actions">
          <button type="button" on:click={() => dispatch('save', drafts[index])}>保存条目</button>
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
  .meta {
    font-size: 0.82rem;
    color: rgba(255, 243, 214, 0.74);
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

  .actions {
    display: flex;
    gap: 10px;
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
</style>
