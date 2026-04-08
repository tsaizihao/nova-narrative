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
    border: none;
    border-radius: 999px;
    background: rgba(17, 16, 20, 0.9);
    color: #f7e5bf;
    font: inherit;
    cursor: pointer;
  }
</style>
