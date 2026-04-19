<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import ReaderControlDock from './ReaderControlDock.svelte';
  import ReaderOverlayDrawer from './ReaderOverlayDrawer.svelte';
  import ReaderStage from './ReaderStage.svelte';
  import StoryCodexPanel from './StoryCodexPanel.svelte';
  import StoryStatePanel from './StoryStatePanel.svelte';
  import type { ReaderSceneBlock } from '$lib/modules/runtime/reader-history';
  import type { RuntimeSnapshot } from '$lib/types';

  interface ReaderActivityItem {
    id: string;
    label: string;
    detail: string;
    tone: 'muted' | 'accent' | 'danger';
  }

  export let projectName = '';
  export let snapshot: RuntimeSnapshot;
  export let history: ReaderSceneBlock[] = [];
  export let activity: ReaderActivityItem[] = [];
  export let freeInput = '';
  export let busy = false;
  export let busyLabel = '';
  export let error = '';
  export let autoplay = false;
  export let retryAvailable = false;

  const dispatch = createEventDispatcher<{
    exit: void;
    choose: string;
    freeInputChange: string;
    submitFreeInput: void;
    clearInput: void;
    retry: void;
    toggleAutoplay: void;
    rewind: string;
    overlayChange: { worldOpen: boolean; stateOpen: boolean };
  }>();

  let worldOpen = false;
  let stateOpen = false;
  let worldTrigger: HTMLButtonElement | null = null;
  let stateTrigger: HTMLButtonElement | null = null;

  function publishOverlayChange() {
    dispatch('overlayChange', { worldOpen, stateOpen });
  }

  function openWorld() {
    worldOpen = true;
    stateOpen = false;
    publishOverlayChange();
  }

  function closeWorld() {
    if (!worldOpen) return;
    worldOpen = false;
    publishOverlayChange();
    worldTrigger?.focus();
  }

  function openState() {
    stateOpen = true;
    worldOpen = false;
    publishOverlayChange();
  }

  function closeState() {
    if (!stateOpen) return;
    stateOpen = false;
    publishOverlayChange();
    stateTrigger?.focus();
  }
</script>

<section class="reader-mobile" data-tone="paper" data-shell-layout="framed-bottom">
  <header class="mobile-head">
    <div class="head-main">
      <p class="project-name">{projectName || '互动故事'}</p>
      <h1>{snapshot.payload.scene.title}</h1>
    </div>
    <div class="mobile-tools">
      <button type="button" on:click={() => dispatch('exit')}>返回审阅台</button>
      <button bind:this={worldTrigger} type="button" on:click={openWorld}>世界设定</button>
      <button bind:this={stateTrigger} type="button" on:click={openState}>状态与日志</button>
    </div>
  </header>

  <div class="reader-body" data-reader-region="story-scroll" data-safe-area="bottom-dock">
    <ReaderStage blocks={history} {activity} />
  </div>

  <div class="reader-dock-shell" data-layout="fixed-bottom">
    <ReaderControlDock
      scene={snapshot.payload.scene}
      ruleFlags={snapshot.payload.session.rule_flags}
      {freeInput}
      {busy}
      {busyLabel}
      {error}
      {autoplay}
      {retryAvailable}
      on:choose={(event) => dispatch('choose', event.detail)}
      on:freeInputChange={(event) => dispatch('freeInputChange', event.detail)}
      on:submitFreeInput={() => dispatch('submitFreeInput')}
      on:clearInput={() => dispatch('clearInput')}
      on:retry={() => dispatch('retry')}
      on:toggleAutoplay={() => dispatch('toggleAutoplay')}
    />
  </div>

  <ReaderOverlayDrawer title="世界设定" side="left" open={worldOpen} on:close={closeWorld}>
    <StoryCodexPanel
      codex={snapshot.codex}
      session={snapshot.payload.session}
      activeLore={snapshot.payload.active_lore}
      activeRules={snapshot.payload.active_rules}
      {busy}
      {busyLabel}
      on:rewind={(event) => dispatch('rewind', event.detail)}
    />
  </ReaderOverlayDrawer>

  <ReaderOverlayDrawer title="状态与日志" side="right" open={stateOpen} on:close={closeState}>
    <StoryStatePanel
      storyState={snapshot.payload.story_state}
      activeRules={snapshot.payload.active_rules}
      activityLog={activity}
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
    --reader-dock-clearance: clamp(260px, 36vh, 360px);
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .mobile-head {
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 20px;
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(244, 236, 225, 0.82)),
      var(--reader-shell-surface, rgba(248, 243, 234, 0.98));
  }

  .head-main {
    display: grid;
    gap: 4px;
  }

  .project-name,
  h1 {
    margin: 0;
  }

  .project-name {
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.78rem;
    color: var(--reader-eyebrow, #91765d);
  }

  h1 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    color: var(--reader-title, #2f261d);
    font-size: clamp(1.35rem, 4vw, 1.75rem);
  }

  .mobile-tools {
    display: flex;
    flex-wrap: wrap;
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

  .reader-body {
    display: grid;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding-bottom: var(--reader-dock-clearance);
    scroll-padding-block-end: var(--reader-dock-clearance);
  }

  .reader-dock-shell {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 10;
  }
</style>
