<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { EndingReport, SessionState } from '$lib/types';

  export let ending: EndingReport;
  export let session: SessionState;
  export let busy = false;
  export let busyLabel = '';

  const dispatch = createEventDispatcher<{ rewind: string; finish: void }>();
</script>

<section class="ending-shell" data-tone="paper">
  <header class="reader-head">
    <div class="head-main">
      <p class="eyebrow">Ending</p>
      <h2>{ending.ending_type}</h2>
      <p class="summary">{ending.summary}</p>
    </div>
  </header>

  <div class="paper-sheet columns">
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

  <div class="paper-sheet rewind">
    <strong>从关键节点重写命运</strong>
    <p class="rewind-copy">你可以带着刚刚得到的结局理解，回到任一关键节点重写命运。</p>
    {#if session.status === 'finished'}
      <p class="archive-copy">本轮互动已归档</p>
    {:else}
      <button type="button" class="finish-button" on:click={() => dispatch('finish')} disabled={busy}>
        完成本轮互动
      </button>
    {/if}
    {#if busy && busyLabel}
      <p class="rewind-status">{busyLabel}</p>
    {/if}
    <div class="rewind-buttons">
      {#each session.available_checkpoints as checkpoint}
        <button
          type="button"
          on:click={() => dispatch('rewind', checkpoint.checkpoint.id)}
          disabled={busy}
        >
          {checkpoint.checkpoint.label}
        </button>
      {/each}
    </div>
  </div>
</section>

<style>
  .ending-shell {
    --reader-shell-surface: rgba(248, 243, 234, 0.96);
    --reader-panel-surface: rgba(253, 250, 245, 0.96);
    --reader-card-surface: rgba(244, 236, 225, 0.82);
    --reader-chip-surface: rgba(121, 103, 81, 0.08);
    --reader-border: rgba(121, 103, 81, 0.14);
    --reader-shadow: 0 18px 36px rgba(70, 54, 39, 0.08);
    --reader-title: #2f261d;
    --reader-body: rgba(47, 38, 29, 0.9);
    --reader-muted: rgba(63, 47, 35, 0.64);
    --reader-eyebrow: #91765d;
    --reader-accent: #1f6a57;
    --reader-accent-soft: rgba(31, 106, 87, 0.14);
    --reader-warm-accent: #9b6d39;
    display: grid;
    gap: 16px;
  }

  .reader-head {
    padding: 20px 22px;
    border-radius: 24px;
    border: 1px solid var(--reader-border);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(244, 236, 225, 0.82)),
      var(--reader-shell-surface);
    box-shadow: var(--reader-shadow);
  }

  .head-main {
    display: grid;
    gap: 8px;
  }

  .paper-sheet {
    padding: 22px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(246, 238, 226, 0.96)),
      rgba(248, 243, 234, 0.98);
    box-shadow: 0 18px 36px rgba(70, 54, 39, 0.08);
  }

  .eyebrow {
    margin: 0;
    color: var(--reader-eyebrow);
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.7rem;
  }

  h2 {
    margin: 0 0 12px;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2.2rem, 4vw, 3.4rem);
    color: var(--reader-title);
  }

  .summary {
    margin: 0;
    line-height: 1.8;
    color: var(--reader-body);
    max-width: 60ch;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  article {
    padding: 20px;
    border-radius: 22px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(248, 241, 231, 0.86)),
      var(--reader-panel-surface);
    border: 1px solid var(--reader-border);
  }

  strong {
    display: block;
    margin-bottom: 10px;
    color: var(--reader-title);
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: var(--reader-body);
    line-height: 1.8;
  }

  .rewind-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .rewind-copy,
  .archive-copy,
  .rewind-status {
    margin: 0 0 12px;
    line-height: 1.7;
    color: var(--reader-body);
  }

  .archive-copy {
    color: var(--reader-accent);
    font-weight: 600;
  }

  .rewind-status {
    color: var(--reader-accent);
  }

  .finish-button,
  .rewind-buttons button {
    border: 1px solid var(--reader-border);
    border-radius: 999px;
    padding: 10px 14px;
    background: var(--reader-card-surface);
    color: var(--reader-title);
    font: inherit;
    cursor: pointer;
  }

  .finish-button {
    margin-bottom: 12px;
    background: rgba(31, 106, 87, 0.08);
    color: var(--reader-accent);
  }

  .finish-button:disabled,
  .rewind-buttons button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .finish-button:hover,
  .rewind-buttons button:hover {
    border-color: rgba(31, 106, 87, 0.24);
    background: var(--reader-accent-soft);
    color: var(--reader-accent);
  }

  @media (max-width: 860px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }
</style>
