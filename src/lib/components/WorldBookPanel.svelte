<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import { loreSlotLabel, loreSourceLabel } from '$lib/rule-helpers';
  import type { WorldBookEntry } from '$lib/types';

  export let entries: WorldBookEntry[] = [];
  export let activeId: string | null = null;
  export let draft: WorldBookEntry | null = null;
  export let dirty = false;
  export let saveBusy = false;
  export let deleteBusy = false;

  const dispatch = createEventDispatcher<{
    select: string;
    change: WorldBookEntry;
    save: void;
    remove: void;
  }>();

  function updateDraft(patch: Partial<WorldBookEntry>) {
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
      <h3>世界书</h3>
    </div>
    <p class="count">{entries.length} 条 lore</p>
  </div>

  {#if entries.length && draft}
    <div class="workspace">
      <div class="entity-list">
        {#each entries as entry}
          <button
            type="button"
            class:active={entry.id === activeId}
            on:click={() => dispatch('select', entry.id)}
          >
            <strong>{entry.title}</strong>
            <span>{loreSlotLabel(entry.insertion_mode)}</span>
          </button>
        {/each}
      </div>

      <article class="editor">
        <header class="document-head" data-testid="worldbook-document-head">
          <div class="document-meta">
            <span class="type-chip">世界书</span>
            <span class="meta-chip">{loreSlotLabel(draft.insertion_mode)}</span>
            <span class="meta-chip">{loreSourceLabel(draft.source)}</span>
          </div>

          <div class="document-title-row">
            <div class="document-copy">
              <h3>{draft.title || '未命名条目'}</h3>
              <p class="document-note">当前条目会出现在 {loreSlotLabel(draft.insertion_mode)}</p>
            </div>

            <label class="state-toggle" data-testid="worldbook-enabled-row">
              <span>状态</span>
              <span class="toggle-copy">启用条目</span>
              <input
                aria-label="启用条目"
                type="checkbox"
                checked={draft.enabled}
                on:change={(event) =>
                  updateDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })}
              />
            </label>
          </div>
        </header>
        <label>
          <span>标题</span>
          <input
            value={draft.title}
            on:input={(event) =>
              updateDraft({ title: (event.currentTarget as HTMLInputElement).value })}
          />
        </label>
        <div class="row">
          <label>
            <span>插槽</span>
            <select
              value={draft.insertion_mode}
              on:change={(event) =>
                updateDraft({
                  insertion_mode: (event.currentTarget as HTMLSelectElement)
                    .value as WorldBookEntry['insertion_mode']
                })}
            >
              <option value="scene_prelude">场景前奏</option>
              <option value="rules_guard">规则守卫</option>
              <option value="codex_only">阅读侧栏</option>
            </select>
          </label>
        </div>
        <label>
          <span>内容</span>
          <textarea
            rows="5"
            value={draft.content}
            on:input={(event) =>
              updateDraft({ content: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
        <div class="editor-footer" data-testid="worldbook-editor-footer">
          <p class="state">{dirty ? '有未保存更改' : '已与当前项目同步'}</p>
          <div class="actions">
            <button
              type="button"
              class="ghost"
              disabled={deleteBusy}
              on:click={() => dispatch('remove')}
            >
              删除条目
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
    <p class="empty">当前没有可编辑的世界书条目。</p>
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
  .state {
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
    color: rgba(63, 47, 35, 0.62);
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
    align-items: center;
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

  .row {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  label {
    display: grid;
    gap: 8px;
  }

  label span {
    font-size: 0.82rem;
    color: rgba(63, 47, 35, 0.82);
  }

  .state-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(248, 243, 234, 0.9);
    border: 1px solid rgba(121, 103, 81, 0.14);
  }

  .toggle-copy {
    color: rgba(63, 47, 35, 0.76);
    font-size: 0.82rem;
  }

  .state-toggle > span:first-child {
    color: #2f261d;
    font-size: 0.82rem;
    font-weight: 700;
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

  @media (max-width: 960px) {
    .workspace,
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
