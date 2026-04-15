<script lang="ts">
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { RuntimeSnapshot } from '$lib/types';

  export let snapshot: RuntimeSnapshot;
  export let freeInput = '';
  export let busy = false;
  export let busyLabel = '';
  export let error = '';
</script>

<section class="reader-desktop" data-tone="paper">
  <aside class="rail rail-left">
    <StoryCodexPanel
      codex={snapshot.codex}
      session={snapshot.payload.session}
      activeLore={snapshot.payload.active_lore}
      activeRules={snapshot.payload.active_rules}
      {busy}
      {busyLabel}
      on:rewind
    />
  </aside>

  <div class="stage-column">
    <ReaderStage
      payload={snapshot.payload}
      {freeInput}
      {busy}
      {busyLabel}
      {error}
      on:choose
      on:freeInputChange
      on:submitFreeInput
    />
  </div>

  <aside class="rail rail-right">
    <StoryStatePanel
      storyState={snapshot.payload.story_state}
      activeRules={snapshot.payload.active_rules}
    />
  </aside>
</section>

<style>
  .reader-desktop {
    --reader-shell-surface: rgba(248, 243, 234, 0.96);
    --reader-panel-surface: rgba(253, 250, 245, 0.96);
    --reader-card-surface: rgba(244, 236, 225, 0.82);
    --reader-chip-surface: rgba(121, 103, 81, 0.08);
    --reader-border: rgba(121, 103, 81, 0.14);
    --reader-shadow: 0 18px 36px rgba(70, 54, 39, 0.08);
    --reader-stage-shadow: 0 22px 44px rgba(89, 68, 48, 0.12);
    --reader-title: #2f261d;
    --reader-body: rgba(47, 38, 29, 0.9);
    --reader-muted: rgba(63, 47, 35, 0.64);
    --reader-eyebrow: #91765d;
    --reader-accent: #1f6a57;
    --reader-accent-soft: rgba(31, 106, 87, 0.14);
    --reader-warm-accent: #9b6d39;
    --reader-danger: #b14d3b;
    --reader-rail-width: 272px;
    display: grid;
    grid-template-columns: var(--reader-rail-width) minmax(0, 1fr) var(--reader-rail-width);
    gap: 20px;
    align-items: start;
  }

  .stage-column {
    min-width: 0;
    max-width: 780px;
  }

  .rail {
    min-width: 0;
  }

  @media (max-width: 1200px) {
    .reader-desktop {
      grid-template-columns: 1fr;
    }
  }
</style>
