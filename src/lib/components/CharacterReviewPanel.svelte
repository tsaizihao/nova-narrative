<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { CharacterCard } from '$lib/types';

  export let cards: CharacterCard[] = [];

  const dispatch = createEventDispatcher<{ save: CharacterCard }>();

  let drafts: CharacterCard[] = [];
  let previousCards: CharacterCard[] = [];
  let activeIndex = 0;

  function cloneCard(card: CharacterCard): CharacterCard {
    return JSON.parse(JSON.stringify(card)) as CharacterCard;
  }

  $: if (cards !== previousCards) {
    drafts = cards.map(cloneCard);
    previousCards = cards;
    activeIndex = Math.min(activeIndex, Math.max(cards.length - 1, 0));
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Review</p>
      <h3>角色卡</h3>
    </div>
    <p>{cards.length} 位角色</p>
  </div>

  {#if drafts.length}
    <div class="workspace">
      <div class="entity-list">
        {#each drafts as card, index}
          <button
            type="button"
            class:active={index === activeIndex}
            on:click={() => (activeIndex = index)}
          >
            <strong>{card.name}</strong>
            <span>{card.identity || '待补充身份'}</span>
          </button>
        {/each}
      </div>

      <article class="editor">
        <label>
          <span>姓名</span>
          <input bind:value={drafts[activeIndex].name} />
        </label>
        <div class="row">
          <label>
            <span>身份</span>
            <input bind:value={drafts[activeIndex].identity} />
          </label>
          <label>
            <span>性别</span>
            <input bind:value={drafts[activeIndex].gender} />
          </label>
        </div>
        <label>
          <span>摘要</span>
          <textarea bind:value={drafts[activeIndex].summary} rows="3"></textarea>
        </label>
        <label>
          <span>欲望</span>
          <textarea bind:value={drafts[activeIndex].desire} rows="2"></textarea>
        </label>
        <label>
          <span>秘密（用 `；` 分隔）</span>
          <textarea
            value={drafts[activeIndex].secrets.join('；')}
            rows="2"
            on:input={(event) => {
              drafts[activeIndex].secrets = event.currentTarget.value
                .split('；')
                .map((item) => item.trim())
                .filter(Boolean);
              drafts = drafts;
            }}
          ></textarea>
        </label>
        <button type="button" class="primary" on:click={() => dispatch('save', drafts[activeIndex])}>
          保存并刷新预览
        </button>
      </article>
    </div>
  {:else}
    <p class="empty">当前没有可编辑的角色卡。</p>
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

  .entity-list span {
    color: rgba(63, 47, 35, 0.62);
    font-size: 0.82rem;
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

  .primary {
    min-height: 44px;
    border-radius: 999px;
    border: none;
    background: #1f6a57;
    color: #f6f3eb;
    cursor: pointer;
    font-weight: 700;
  }

  @media (max-width: 920px) {
    .workspace,
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
