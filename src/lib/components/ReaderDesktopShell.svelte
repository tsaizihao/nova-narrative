<script lang="ts">
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { ScenePayload, SessionState, StoryCodex } from '$lib/types';

  export let payload: ScenePayload;
  export let codex: StoryCodex | null = null;
  export let session: SessionState;
  export let freeInput = '';
  export let busy = false;
  export let error = '';
</script>

<section class="reader-desktop">
  <aside class="rail rail-left">
    <StoryCodexPanel
      {codex}
      {session}
      activeLore={payload.active_lore}
      activeRules={payload.active_rules}
      on:rewind
    />
  </aside>

  <div class="stage-column">
    <ReaderStage {payload} {freeInput} {busy} {error} on:choose on:freeInputChange on:submitFreeInput />
  </div>

  <aside class="rail rail-right">
    <StoryStatePanel storyState={payload.story_state} activeRules={payload.active_rules} />
  </aside>
</section>

<style>
  .reader-desktop {
    --reader-shell-surface: rgba(15, 13, 16, 0.92);
    --reader-panel-surface: rgba(28, 24, 25, 0.88);
    --reader-card-surface: rgba(255, 248, 230, 0.05);
    --reader-border: rgba(255, 243, 214, 0.08);
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
