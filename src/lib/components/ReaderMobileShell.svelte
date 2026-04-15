<script lang="ts">
  import ReaderOverlayDrawer from './ReaderOverlayDrawer.svelte';
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { RuntimeSnapshot } from '$lib/types';

  export let snapshot: RuntimeSnapshot;
  export let freeInput = '';
  export let busy = false;
  export let busyLabel = '';
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

<section class="reader-mobile" data-tone="paper">
  <div class="mobile-tools">
    <button type="button" aria-label="打开世界信息" on:click={openWorld}>世界</button>
    <button type="button" aria-label="打开状态信息" on:click={openState}>状态</button>
  </div>

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

  <ReaderOverlayDrawer title="世界侧栏" open={worldOpen} on:close={() => (worldOpen = false)}>
    <StoryCodexPanel
      codex={snapshot.codex}
      session={snapshot.payload.session}
      activeLore={snapshot.payload.active_lore}
      activeRules={snapshot.payload.active_rules}
      {busy}
      {busyLabel}
      on:rewind
    />
  </ReaderOverlayDrawer>

  <ReaderOverlayDrawer title="世界状态" open={stateOpen} on:close={() => (stateOpen = false)}>
    <StoryStatePanel
      storyState={snapshot.payload.story_state}
      activeRules={snapshot.payload.active_rules}
    />
  </ReaderOverlayDrawer>
</section>

<style>
  .reader-mobile {
    --reader-shell-surface: rgba(248, 243, 234, 0.98);
    --reader-panel-surface: rgba(253, 250, 245, 0.98);
    --reader-card-surface: rgba(244, 236, 225, 0.86);
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
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
    border-radius: 999px;
    background: var(--reader-card-surface, rgba(244, 236, 225, 0.86));
    color: var(--reader-title, #2f261d);
    font: inherit;
    cursor: pointer;
  }
</style>
