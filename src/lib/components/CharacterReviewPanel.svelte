<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { CharacterCard } from '$lib/types';

  export let cards: CharacterCard[] = [];

  const dispatch = createEventDispatcher<{ save: CharacterCard }>();

  let drafts: CharacterCard[] = [];
  let previousCards: CharacterCard[] = [];

  function cloneCard(card: CharacterCard): CharacterCard {
    return JSON.parse(JSON.stringify(card)) as CharacterCard;
  }

  $: if (cards !== previousCards) {
    drafts = cards.map(cloneCard);
    previousCards = cards;
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

  <div class="list">
    {#each drafts as card, index}
      <article>
        <label>
          <span>姓名</span>
          <input bind:value={drafts[index].name} />
        </label>
        <div class="row">
          <label>
            <span>身份</span>
            <input bind:value={drafts[index].identity} />
          </label>
          <label>
            <span>性别</span>
            <input bind:value={drafts[index].gender} />
          </label>
        </div>
        <label>
          <span>摘要</span>
          <textarea bind:value={drafts[index].summary} rows="3"></textarea>
        </label>
        <label>
          <span>欲望</span>
          <textarea bind:value={drafts[index].desire} rows="2"></textarea>
        </label>
        <label>
          <span>秘密（用 `；` 分隔）</span>
          <textarea
            value={drafts[index].secrets.join('；')}
            rows="2"
            on:input={(event) => {
              drafts[index].secrets = event.currentTarget.value
                .split('；')
                .map((item) => item.trim())
                .filter(Boolean);
              drafts = drafts;
            }}
          ></textarea>
        </label>
        <button
          type="button"
          on:click={() => dispatch('save', drafts[index])}
        >
          保存角色
        </button>
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

  span {
    font-size: 0.82rem;
    color: rgba(255, 243, 214, 0.74);
  }

  input,
  textarea,
  button {
    font: inherit;
  }

  input,
  textarea {
    border-radius: 14px;
    border: 1px solid rgba(255, 238, 207, 0.1);
    background: rgba(15, 11, 9, 0.92);
    color: #fff4dd;
    padding: 12px 14px;
  }

  button {
    min-height: 42px;
    border-radius: 999px;
    border: 1px solid rgba(255, 227, 170, 0.22);
    background: linear-gradient(135deg, rgba(204, 150, 70, 0.22), rgba(255, 229, 178, 0.12));
    color: #fff4dd;
    cursor: pointer;
  }
</style>
