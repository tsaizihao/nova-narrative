<script lang="ts">
  import ReaderOverlayDrawer from './ReaderOverlayDrawer.svelte';
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { ScenePayload, StoryCodex } from '$lib/types';

  export let payload: ScenePayload;
  export let codex: StoryCodex | null = null;
  export let freeInput = '';
  export let busy = false;
  export let error = '';

  let worldOpen = false;
  let stateOpen = false;

  function openWorld() {
    worldOpen = true;
    stateOpen = false;
  }

  function openState() {
    stateOpen = true;
    worldOpen = false;
  }
</script>

<section class="reader-mobile">
  <div class="mobile-tools">
    <button type="button" aria-label="打开世界信息" on:click={openWorld}>世界</button>
    <button type="button" aria-label="打开状态信息" on:click={openState}>状态</button>
  </div>

  <ReaderStage {payload} {freeInput} {busy} {error} on:choose on:freeInputChange on:submitFreeInput />

  <ReaderOverlayDrawer title="世界侧栏" open={worldOpen} on:close={() => (worldOpen = false)}>
    <StoryCodexPanel
      {codex}
      session={payload.session}
      activeLore={payload.active_lore}
      activeRules={payload.active_rules}
      on:rewind
    />
  </ReaderOverlayDrawer>

  <ReaderOverlayDrawer title="世界状态" open={stateOpen} on:close={() => (stateOpen = false)}>
    <StoryStatePanel storyState={payload.story_state} activeRules={payload.active_rules} />
  </ReaderOverlayDrawer>
</section>

<style>
  .reader-mobile {
    --reader-shell-surface: rgba(15, 13, 16, 0.92);
    --reader-panel-surface: rgba(28, 24, 25, 0.88);
    --reader-card-surface: rgba(255, 248, 230, 0.05);
    --reader-border: rgba(255, 243, 214, 0.08);
    display: grid;
    gap: 12px;
  }

  .mobile-tools {
    display: flex;
    gap: 10px;
  }

  .mobile-tools button {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid rgba(255, 238, 207, 0.08);
    border-radius: 999px;
    background: rgba(23, 20, 21, 0.92);
    color: #f7e5bf;
    font: inherit;
    cursor: pointer;
  }
</style>
