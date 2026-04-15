<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';

  import type { ReaderLayoutMode } from '$lib/ui-layout';
  import EndingScreen from './EndingScreen.svelte';
  import ReaderDesktopShell from './ReaderDesktopShell.svelte';
  import ReaderMobileShell from './ReaderMobileShell.svelte';
  import {
    createRuntimeWorkspaceController,
    type RuntimeWorkspaceController,
    type RuntimeWorkspaceState
  } from '$lib/modules/runtime/workspace';

  export let sessionId: string;
  export let layoutMode: ReaderLayoutMode = 'desktop';

  const dispatch = createEventDispatcher<{
    exitReader: void;
  }>();

  let workspace: RuntimeWorkspaceController | null = null;
  let workspaceState: RuntimeWorkspaceState | null = null;
  let unsubscribe: Unsubscriber | null = null;
  let activeSessionId = '';

  function attachWorkspace(nextSessionId: string) {
    unsubscribe?.();
    workspace = createRuntimeWorkspaceController(nextSessionId);
    unsubscribe = workspace.subscribe((value) => {
      workspaceState = value;
    });
    activeSessionId = nextSessionId;
    void workspace.load();
  }

  function withWorkspace(action: (controller: RuntimeWorkspaceController) => void | Promise<void>) {
    if (!workspace) return;
    void action(workspace);
  }

  function reloadSnapshot() {
    withWorkspace((controller) => controller.load());
  }

  $: if (sessionId && sessionId !== activeSessionId) {
    attachWorkspace(sessionId);
  }

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<div class="runtime-stage-shell" data-testid="runtime-stage-shell">
  <div class="runtime-shell-actions">
    <button type="button" class="runtime-nav-button" on:click={() => dispatch('exitReader')}>
      返回审阅台
    </button>
  </div>

  {#if workspaceState?.status === 'loading' && !workspaceState.snapshot}
    <section class="runtime-state-card" data-testid="runtime-loading-state">
      <p class="eyebrow">Reader</p>
      <h2>正在载入互动故事</h2>
      <p>我们先把当前 session 的场景、世界信息和状态快照一起取回来。</p>
    </section>
  {:else if workspaceState?.snapshot}
    {#if workspaceState.busy || workspaceState.error}
      <section
        class="runtime-feedback"
        class:busy={workspaceState.busy}
        class:error={Boolean(workspaceState.error)}
        data-testid="runtime-feedback-lane"
      >
        <p class="eyebrow">Runtime</p>
        <strong>
          {#if workspaceState.busy}
            {workspaceState.busyLabel}
          {:else}
            动作处理失败
          {/if}
        </strong>
        <p>
          {#if workspaceState.busy}
            当前场景和世界状态会在动作完成后一起刷新。
          {:else}
            {workspaceState.error}
          {/if}
        </p>
        {#if !workspaceState.busy}
          <button type="button" class="runtime-retry-button" on:click={reloadSnapshot}>
            重新载入当前场景
          </button>
        {/if}
      </section>
    {/if}

    {#if workspaceState.snapshot.payload.session.ending_report}
      <EndingScreen
        ending={workspaceState.snapshot.payload.session.ending_report}
        session={workspaceState.snapshot.payload.session}
        busy={workspaceState.busy}
        busyLabel={workspaceState.busyLabel}
        on:rewind={(event) => withWorkspace((controller) => controller.rewind(event.detail))}
      />
    {:else if layoutMode === 'desktop'}
      <ReaderDesktopShell
        snapshot={workspaceState.snapshot}
        freeInput={workspaceState.freeInput}
        busy={workspaceState.busy}
        busyLabel={workspaceState.busyLabel}
        error={workspaceState.error}
        on:choose={(event) => withWorkspace((controller) => controller.choose(event.detail))}
        on:freeInputChange={(event) =>
          withWorkspace((controller) => controller.updateFreeInput(event.detail))}
        on:submitFreeInput={() => withWorkspace((controller) => controller.submitFreeInput())}
        on:rewind={(event) => withWorkspace((controller) => controller.rewind(event.detail))}
      />
    {:else}
      <ReaderMobileShell
        snapshot={workspaceState.snapshot}
        freeInput={workspaceState.freeInput}
        busy={workspaceState.busy}
        busyLabel={workspaceState.busyLabel}
        error={workspaceState.error}
        on:choose={(event) => withWorkspace((controller) => controller.choose(event.detail))}
        on:freeInputChange={(event) =>
          withWorkspace((controller) => controller.updateFreeInput(event.detail))}
        on:submitFreeInput={() => withWorkspace((controller) => controller.submitFreeInput())}
        on:rewind={(event) => withWorkspace((controller) => controller.rewind(event.detail))}
      />
    {/if}
  {:else}
    <section class="runtime-state-card error" data-testid="runtime-error-state">
      <p class="eyebrow">Reader</p>
      <h2>互动故事加载失败</h2>
      <p>{workspaceState?.error ?? '当前 session 的运行时快照暂时不可用。'}</p>
      <button type="button" class="runtime-retry-button" on:click={reloadSnapshot}>
        重新载入当前场景
      </button>
    </section>
  {/if}
</div>

<style>
  .runtime-stage-shell {
    display: grid;
    gap: 16px;
  }

  .runtime-shell-actions {
    display: flex;
    justify-content: flex-start;
  }

  .runtime-nav-button,
  .runtime-retry-button {
    width: fit-content;
    min-height: 38px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(121, 103, 81, 0.18);
    background: rgba(255, 255, 255, 0.7);
    color: #2f261d;
    font: inherit;
    cursor: pointer;
  }

  .runtime-nav-button:hover,
  .runtime-retry-button:hover {
    border-color: rgba(31, 106, 87, 0.24);
    background: rgba(237, 245, 241, 0.92);
    color: #1f6a57;
  }

  .runtime-state-card {
    display: grid;
    gap: 10px;
    padding: 28px;
    border-radius: 28px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(244, 236, 225, 0.82)),
      rgba(248, 243, 234, 0.96);
    box-shadow: 0 18px 36px rgba(70, 54, 39, 0.08);
  }

  .runtime-state-card.error {
    border-color: rgba(177, 77, 59, 0.18);
    background:
      linear-gradient(180deg, rgba(255, 251, 246, 0.74), rgba(246, 234, 228, 0.88)),
      rgba(248, 243, 234, 0.96);
  }

  .runtime-feedback {
    display: grid;
    gap: 8px;
    padding: 18px 20px;
    border-radius: 22px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(244, 236, 225, 0.82)),
      rgba(248, 243, 234, 0.96);
    box-shadow: 0 12px 24px rgba(70, 54, 39, 0.06);
  }

  .runtime-feedback.busy {
    border-color: rgba(31, 106, 87, 0.18);
  }

  .runtime-feedback.error {
    border-color: rgba(177, 77, 59, 0.18);
  }

  .eyebrow {
    margin: 0;
    color: #91765d;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h2,
  strong,
  p {
    margin: 0;
  }

  h2 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    color: #2f261d;
  }

  p:last-child {
    line-height: 1.7;
    color: rgba(47, 38, 29, 0.78);
  }

</style>
