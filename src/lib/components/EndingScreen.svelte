<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { EndingReport, SessionState } from '$lib/types';

  export let ending: EndingReport;
  export let session: SessionState;

  const dispatch = createEventDispatcher<{ rewind: string }>();
</script>

<section class="ending">
  <div class="hero">
    <p class="eyebrow">Ending Report</p>
    <h2>{ending.ending_type}</h2>
    <p>{ending.summary}</p>
  </div>

  <div class="columns">
    <article>
      <strong>决定性转折</strong>
      <ul>
        {#each ending.decisive_turns as turn}
          <li>{turn}</li>
        {/each}
      </ul>
    </article>
    <article>
      <strong>未决线索</strong>
      <ul>
        {#each ending.unresolved_threads as thread}
          <li>{thread}</li>
        {/each}
      </ul>
    </article>
  </div>

  <div class="rewind">
    <strong>从关键节点重写命运</strong>
    <div class="rewind-buttons">
      {#each session.available_checkpoints as checkpoint}
        <button type="button" on:click={() => dispatch('rewind', checkpoint.checkpoint.id)}>
          {checkpoint.checkpoint.label}
        </button>
      {/each}
    </div>
  </div>
</section>

<style>
  .ending {
    display: grid;
    gap: 24px;
    padding: 36px;
    border-radius: 30px;
    border: 1px solid rgba(255, 243, 214, 0.1);
    background:
      radial-gradient(circle at top left, rgba(245, 220, 171, 0.1), transparent 36%),
      rgba(14, 11, 9, 0.84);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.7rem;
  }

  h2 {
    margin: 0 0 12px;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2.2rem, 4vw, 3.4rem);
  }

  .hero p:last-child {
    margin: 0;
    line-height: 1.8;
    color: rgba(255, 243, 214, 0.78);
    max-width: 60ch;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  article,
  .rewind {
    padding: 22px;
    border-radius: 22px;
    background: rgba(27, 20, 16, 0.88);
    border: 1px solid rgba(255, 238, 207, 0.08);
  }

  strong {
    display: block;
    margin-bottom: 10px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: rgba(255, 243, 214, 0.74);
    line-height: 1.8;
  }

  .rewind-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .rewind-buttons button {
    border: 1px solid rgba(255, 238, 207, 0.08);
    border-radius: 999px;
    padding: 10px 14px;
    background: rgba(255, 248, 230, 0.04);
    color: #f7e5bf;
    font: inherit;
    cursor: pointer;
  }

  @media (max-width: 860px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }
</style>

