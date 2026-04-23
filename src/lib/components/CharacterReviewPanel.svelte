<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { CharacterCard } from '$lib/types';

  export let cards: CharacterCard[] = [];
  export let activeId: string | null = null;
  export let draft: CharacterCard | null = null;
  export let dirty = false;
  export let saveBusy = false;

  const dispatch = createEventDispatcher<{
    select: string;
    change: CharacterCard;
    save: void;
  }>();

  function updateDraft(patch: Partial<CharacterCard>) {
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
      <h3>角色卡</h3>
    </div>
    <p class="count">{cards.length} 位角色</p>
  </div>

  {#if cards.length && draft}
    <div class="workspace">
      <div class="entity-list">
        {#each cards as card}
          <button
            type="button"
            class:active={card.id === activeId}
            on:click={() => dispatch('select', card.id)}
          >
            <strong>{card.name}</strong>
            <span>{card.identity || '待补充身份'}</span>
          </button>
        {/each}
      </div>

      <article class="editor">
        <header class="document-head" data-testid="character-document-head">
          <div class="document-meta">
            <span class="type-chip">角色卡</span>
            <span class="meta-chip">{draft.role || '未设角色定位'}</span>
          </div>
          <h3>{draft.name || '未命名角色'}</h3>
          <p class="document-note">
            {draft.identity || '待补充身份'} · {draft.faction || '未设阵营'}
          </p>
        </header>
        <label>
          <span>姓名</span>
          <input
            value={draft.name}
            on:input={(event) =>
              updateDraft({ name: (event.currentTarget as HTMLInputElement).value })}
          />
        </label>
        <div class="row">
          <label>
            <span>身份</span>
            <input
              value={draft.identity}
              on:input={(event) =>
                updateDraft({ identity: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <label>
            <span>性别</span>
            <input
              value={draft.gender}
              on:input={(event) =>
                updateDraft({ gender: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
        </div>
        <label>
          <span>摘要</span>
          <textarea
            rows="3"
            value={draft.summary}
            on:input={(event) =>
              updateDraft({ summary: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
        <label>
          <span>欲望</span>
          <textarea
            rows="2"
            value={draft.desire}
            on:input={(event) =>
              updateDraft({ desire: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
        <label>
          <span>秘密（用 `；` 分隔）</span>
          <textarea
            rows="2"
            value={draft.secrets.join('；')}
            on:input={(event) =>
              updateDraft({
                secrets: (event.currentTarget as HTMLTextAreaElement).value
                  .split('；')
                  .map((item) => item.trim())
                  .filter(Boolean)
              })}
          ></textarea>
        </label>
        <div class="editor-footer" data-testid="character-editor-footer">
          <p class="state">{dirty ? '有未保存更改' : '已与当前项目同步'}</p>
          <button
            type="button"
            class="primary"
            disabled={saveBusy}
            on:click={() => dispatch('save')}
          >
            保存更改
          </button>
        </div>
      </article>
    </div>
  {:else}
    <p class="empty">当前没有可编辑的角色卡。</p>
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
    gap: 10px;
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

  input,
  textarea,
  button {
    font: inherit;
  }

  input,
  textarea {
    border-radius: 14px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(250, 246, 239, 0.92);
    color: #2f261d;
    padding: 12px 14px;
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

  .primary {
    min-height: 44px;
    min-width: 148px;
    padding: 0 16px;
    border-radius: 999px;
    border: none;
    background: #1f6a57;
    color: #f6f3eb;
    cursor: pointer;
    font-weight: 700;
  }

  .primary:disabled {
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
