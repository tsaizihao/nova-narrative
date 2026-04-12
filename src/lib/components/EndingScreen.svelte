<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { EndingReport, SessionState } from '$lib/types';

  export let ending: EndingReport;
  export let session: SessionState;

  const dispatch = createEventDispatcher<{ rewind: string }>();
</script>

<section class="ending" data-tone="paper">
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
    gap: 24px;
    padding: 36px;
    border-radius: 30px;
    border: 1px solid var(--reader-border);
    background:
      radial-gradient(circle at top left, rgba(215, 194, 166, 0.32), transparent 42%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(244, 236, 225, 0.7)),
      var(--reader-shell-surface);
    box-shadow: var(--reader-shadow);
  }

  .eyebrow {
    margin: 0 0 10px;
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

  .hero p:last-child {
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

  article,
  .rewind {
    padding: 22px;
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

  .rewind-buttons button {
    border: 1px solid var(--reader-border);
    border-radius: 999px;
    padding: 10px 14px;
    background: var(--reader-card-surface);
    color: var(--reader-title);
    font: inherit;
    cursor: pointer;
  }

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
