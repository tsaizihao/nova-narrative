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

<section class="reader-desktop" data-tone="paper" data-shell-layout="framed-bottom">
  <header class="reader-head">
    <div class="head-main">
      <p class="project-name">{projectName || '互动故事'}</p>
      <h1>{snapshot.payload.scene.title}</h1>
      <p class="chapter-meta">第 {snapshot.payload.scene.chapter} 章</p>
    </div>
    <div class="head-actions">
      <button type="button" on:click={() => dispatch('exit')}>返回审阅台</button>
      <button bind:this={worldTrigger} type="button" on:click={openWorld}>世界设定</button>
      <button bind:this={stateTrigger} type="button" on:click={openState}>状态与日志</button>
    </div>
  </header>

  <div class="reader-body" data-reader-region="story-scroll">
    <ReaderStage blocks={history} {activity} />
  </div>

  <div class="reader-dock-shell" data-layout="stacked-bottom">
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
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    min-height: calc(100vh - 56px);
  }

  .reader-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    padding: 18px 20px;
    border-radius: 24px;
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(244, 236, 225, 0.82)),
      var(--reader-shell-surface, rgba(248, 243, 234, 0.96));
    box-shadow: var(--reader-shadow, 0 18px 36px rgba(70, 54, 39, 0.08));
  }

  .head-main {
    display: grid;
    gap: 4px;
  }

  .project-name,
  .chapter-meta,
  h1 {
    margin: 0;
  }

  .project-name {
    font-size: 0.84rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--reader-eyebrow, #91765d);
  }

  h1 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    color: var(--reader-title, #2f261d);
    font-size: clamp(1.5rem, 2vw, 2rem);
  }

  .chapter-meta {
    color: var(--reader-muted, rgba(63, 47, 35, 0.64));
    font-size: 0.9rem;
  }

  .head-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .head-actions button {
    min-height: 38px;
    padding: 0 14px;
    border: 1px solid var(--reader-border, rgba(121, 103, 81, 0.14));
    border-radius: 999px;
    background: var(--reader-card-surface, rgba(244, 236, 225, 0.82));
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
  }

  .reader-dock-shell {
    position: relative;
    z-index: 10;
  }

  @media (max-width: 1200px) {
    .reader-head {
      flex-direction: column;
      align-items: stretch;
    }
  }

  @media (max-width: 900px) {
    .reader-desktop {
      min-height: calc(100vh - 36px);
    }
  }
</style>
