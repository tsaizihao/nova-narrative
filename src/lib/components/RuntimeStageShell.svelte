<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';

  import type { ChoiceOption } from '$lib/types';
  import type { ReaderLayoutMode } from '$lib/ui-layout';
  import EndingScreen from './EndingScreen.svelte';
  import ReaderDesktopShell from './ReaderDesktopShell.svelte';
  import ReaderMobileShell from './ReaderMobileShell.svelte';
  import {
    appendReaderSnapshot,
    createReaderHistory,
    resetReaderHistory,
    type ReaderHistoryState
  } from '$lib/modules/runtime/reader-history';
  import {
    createRuntimeWorkspaceController,
    type RuntimeWorkspaceController,
    type RuntimeWorkspaceState
  } from '$lib/modules/runtime/workspace';

  export let sessionId: string;
  export let layoutMode: ReaderLayoutMode = 'desktop';
  export let projectName = '';

  const dispatch = createEventDispatcher<{
    exitReader: void;
  }>();

  let workspace: RuntimeWorkspaceController | null = null;
  let workspaceState: RuntimeWorkspaceState | null = null;
  let unsubscribe: Unsubscriber | null = null;
  let activeSessionId = '';
  let historyState: ReaderHistoryState | null = null;
  let history: ReaderHistoryState['blocks'] = [];
  let activity: Array<{
    id: string;
    label: string;
    detail: string;
    tone: 'muted' | 'accent' | 'danger';
  }> = [];
  let activityCounter = 0;
  let retryAction: { kind: 'choice'; choiceId: string } | { kind: 'free-input'; text: string } | null = null;
  let pendingAction: {
    kind: 'choice' | 'free-input';
    label: string;
    detail: string;
    retryAction: { kind: 'choice'; choiceId: string } | { kind: 'free-input'; text: string };
  } | null = null;
  let autoplay = false;
  let autoplayTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSnapshotRef: RuntimeWorkspaceState['snapshot'] = null;
  let lastSceneId: string | null = null;
  let pendingHistoryReset = false;

  const MAX_ACTIVITY_ITEMS = 6;
  const AUTOPLAY_DELAY_MS = 900;

  function pushActivity(
    item: Omit<(typeof activity)[number], 'id'> & {
      id?: string;
    }
  ) {
    const nextItem = {
      id: item.id ?? `activity-${++activityCounter}`,
      label: item.label,
      detail: item.detail,
      tone: item.tone
    };
    activity = [nextItem, ...activity].slice(0, MAX_ACTIVITY_ITEMS);
  }

  function clearAutoplayTimer() {
    if (!autoplayTimer) return;
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }

  function attachWorkspace(nextSessionId: string) {
    clearAutoplayTimer();
    unsubscribe?.();
    workspace = createRuntimeWorkspaceController(nextSessionId);
    unsubscribe = workspace.subscribe((value) => {
      workspaceState = value;
    });
    activeSessionId = nextSessionId;
    historyState = null;
    history = [];
    activity = [];
    activityCounter = 0;
    retryAction = null;
    pendingAction = null;
    pendingHistoryReset = false;
    autoplay = false;
    lastSnapshotRef = null;
    lastSceneId = null;
    void workspace.load();
  }

  async function withWorkspace(
    action: (controller: RuntimeWorkspaceController) => void | Promise<void>
  ) {
    if (!workspace) return;
    await action(workspace);
  }

  function choiceUnlocked(choice: ChoiceOption) {
    const ruleFlags = workspaceState?.snapshot?.payload.session.rule_flags ?? [];
    return choice.unlock_conditions.every((condition) => ruleFlags.includes(condition));
  }

  function canAutoplayNow() {
    const snapshot = workspaceState?.snapshot;
    if (!snapshot || !autoplay || !workspaceState) return false;
    if (workspaceState.busy || Boolean(workspaceState.error)) return false;

    const choices = snapshot.payload.scene.candidate_choices;
    return choices.length === 1 && snapshot.payload.scene.allow_free_input === false && choiceUnlocked(choices[0]);
  }

  function scheduleAutoplay() {
    if (autoplayTimer || !canAutoplayNow()) return;
    autoplayTimer = setTimeout(() => {
      autoplayTimer = null;
      if (!canAutoplayNow()) return;
      const autoChoiceId = workspaceState?.snapshot?.payload.scene.candidate_choices[0]?.id;
      if (!autoChoiceId) return;
      triggerChoice(autoChoiceId, '自动推进');
    }, AUTOPLAY_DELAY_MS);
  }

  function scrollCurrentSceneIntoView() {
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('.reader-stage .scene-block[data-current="true"]')
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  function reloadSnapshot() {
    pushActivity({
      label: '系统',
      detail: '重新载入当前场景',
      tone: 'muted'
    });
    void withWorkspace((controller) => controller.load());
  }

  function updateFreeInput(value: string) {
    void withWorkspace((controller) => controller.updateFreeInput(value));
  }

  function rewindToCheckpoint(checkpointId: string) {
    pendingHistoryReset = true;
    void withWorkspace((controller) => controller.rewind(checkpointId));
  }

  function setAutoplay(nextValue: boolean) {
    if (autoplay === nextValue) return;
    autoplay = nextValue;
    if (!autoplay) {
      clearAutoplayTimer();
    } else {
      scheduleAutoplay();
    }
  }

  function toggleAutoplay() {
    setAutoplay(!autoplay);
    pushActivity({
      label: '自动播放',
      detail: autoplay ? '自动推进已开启' : '自动推进已关闭',
      tone: 'muted'
    });
  }

  function clearInput() {
    if (!workspaceState?.freeInput.trim()) return;
    void withWorkspace((controller) => controller.updateFreeInput(''));
    pushActivity({
      label: '输入区',
      detail: '已清除当前自由输入',
      tone: 'muted'
    });
  }

  function triggerChoice(choiceId: string, label: string) {
    pendingAction = {
      kind: 'choice',
      label,
      detail: `选择 ${choiceId}`,
      retryAction: { kind: 'choice', choiceId }
    };
    clearAutoplayTimer();
    void withWorkspace((controller) => controller.choose(choiceId));
  }

  function triggerFreeInput(textOverride?: string, label = '自由输入') {
    const text = textOverride?.trim() ?? workspaceState?.freeInput.trim() ?? '';
    if (!text) return;

    pendingAction = {
      kind: 'free-input',
      label,
      detail: text,
      retryAction: { kind: 'free-input', text }
    };
    clearAutoplayTimer();
    if (textOverride != null) {
      workspace?.updateFreeInput(text);
    }
    void withWorkspace((controller) => controller.submitFreeInput());
  }

  function retryFailedAction() {
    if (!retryAction || workspaceState?.busy) return;
    if (retryAction.kind === 'choice') {
      triggerChoice(retryAction.choiceId, '重试选择');
      return;
    }
    triggerFreeInput(retryAction.text, '重试自由输入');
  }

  function overlayChange(event: CustomEvent<{ worldOpen: boolean; stateOpen: boolean }>) {
    if (!event.detail.worldOpen && !event.detail.stateOpen) return;
    if (!autoplay) return;
    setAutoplay(false);
    pushActivity({
      label: '自动播放',
      detail: '抽屉打开，自动推进已暂停',
      tone: 'muted'
    });
  }

  $: if (sessionId && sessionId !== activeSessionId) {
    attachWorkspace(sessionId);
  }

  $: if (workspaceState?.snapshot && workspaceState.snapshot !== lastSnapshotRef) {
    const snapshot = workspaceState.snapshot;
    const currentSceneId = snapshot.payload.scene.id;
    const sceneChanged = Boolean(lastSceneId && lastSceneId !== currentSceneId);
    lastSnapshotRef = snapshot;
    lastSceneId = currentSceneId;

    historyState = pendingHistoryReset
      ? resetReaderHistory(snapshot)
      : historyState
        ? appendReaderSnapshot(historyState, snapshot)
        : createReaderHistory(snapshot);
    history = historyState.blocks;
    pendingHistoryReset = false;

    if (sceneChanged) {
      scrollCurrentSceneIntoView();
    }
  }

  $: if (pendingAction && workspaceState && !workspaceState.busy) {
    if (workspaceState.error) {
      retryAction = pendingAction.retryAction;
      pushActivity({
        label: pendingAction.label,
        detail: workspaceState.error,
        tone: 'danger'
      });
    } else {
      retryAction = null;
      pushActivity({
        label: pendingAction.label,
        detail: pendingAction.detail,
        tone: 'accent'
      });
    }
    pendingAction = null;
  }

  $: if (!canAutoplayNow()) {
    clearAutoplayTimer();
  } else {
    scheduleAutoplay();
  }

  onDestroy(() => {
    clearAutoplayTimer();
    unsubscribe?.();
  });
</script>

<div class="runtime-stage-shell" data-testid="runtime-stage-shell">
  {#if workspaceState?.status === 'loading' && !workspaceState.snapshot}
    <section class="runtime-state-card" data-testid="runtime-loading-state">
      <p class="eyebrow">Reader</p>
      <h2>正在翻开故事页</h2>
      <p>我们正在把当前 session 的场景、世界设定和状态脉络整理到同一页里。</p>
    </section>
  {:else if workspaceState?.snapshot}
    {#if workspaceState.busy || workspaceState.error}
      <section
        class="runtime-feedback"
        class:busy={workspaceState.busy}
        class:error={Boolean(workspaceState.error)}
        data-testid="runtime-feedback-lane"
      >
        <p class="eyebrow">Reader</p>
        <strong>
          {#if workspaceState.busy}
            {workspaceState.busyLabel}
          {:else}
            动作处理失败
          {/if}
        </strong>
        <p class="runtime-copy">
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
        on:finish={() => withWorkspace((controller) => controller.finish())}
        on:rewind={(event) => {
          pendingHistoryReset = true;
          void withWorkspace((controller) => controller.rewind(event.detail));
        }}
      />
    {:else if layoutMode === 'desktop'}
      <ReaderDesktopShell
        {projectName}
        snapshot={workspaceState.snapshot}
        {history}
        {activity}
        freeInput={workspaceState.freeInput}
        busy={workspaceState.busy}
        busyLabel={workspaceState.busyLabel}
        error={workspaceState.error}
        {autoplay}
        retryAvailable={Boolean(retryAction)}
        on:exit={() => dispatch('exitReader')}
        on:choose={(event) => triggerChoice(event.detail, '分支选择')}
        on:freeInputChange={(event) => updateFreeInput(event.detail)}
        on:submitFreeInput={() => triggerFreeInput()}
        on:clearInput={clearInput}
        on:retry={retryFailedAction}
        on:toggleAutoplay={toggleAutoplay}
        on:overlayChange={overlayChange}
        on:rewind={(event) => rewindToCheckpoint(event.detail)}
      />
    {:else}
      <ReaderMobileShell
        {projectName}
        snapshot={workspaceState.snapshot}
        {history}
        {activity}
        freeInput={workspaceState.freeInput}
        busy={workspaceState.busy}
        busyLabel={workspaceState.busyLabel}
        error={workspaceState.error}
        {autoplay}
        retryAvailable={Boolean(retryAction)}
        on:exit={() => dispatch('exitReader')}
        on:choose={(event) => triggerChoice(event.detail, '分支选择')}
        on:freeInputChange={(event) => updateFreeInput(event.detail)}
        on:submitFreeInput={() => triggerFreeInput()}
        on:clearInput={clearInput}
        on:retry={retryFailedAction}
        on:toggleAutoplay={toggleAutoplay}
        on:overlayChange={overlayChange}
        on:rewind={(event) => rewindToCheckpoint(event.detail)}
      />
    {/if}
  {:else}
    <section class="runtime-state-card error" data-testid="runtime-error-state">
      <p class="eyebrow">Reader</p>
      <h2>这页故事暂时没能展开</h2>
      <p class="runtime-copy">{workspaceState?.error ?? '当前 session 的运行时快照暂时不可用。'}</p>
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

  .runtime-copy {
    line-height: 1.7;
    color: rgba(47, 38, 29, 0.78);
  }

</style>
