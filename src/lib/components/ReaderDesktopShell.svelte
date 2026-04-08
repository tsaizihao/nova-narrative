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
    display: grid;
    grid-template-columns: minmax(240px, 280px) minmax(0, 760px) minmax(240px, 280px);
    justify-content: center;
    gap: 18px;
    align-items: start;
  }

  .stage-column {
    min-width: 0;
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
