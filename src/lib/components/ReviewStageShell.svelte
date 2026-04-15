<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { Unsubscriber } from 'svelte/store';

  import PhaseStepper from '$lib/components/PhaseStepper.svelte';
  import ReviewWorkspace from '$lib/components/ReviewWorkspace.svelte';
  import {
    createReviewWorkspaceController,
    type ReviewWorkspaceController,
    type ReviewWorkspaceState
  } from '$lib/modules/review/workspace';
  import type { NovelProject } from '$lib/types';

  export let project: NovelProject;
  export let busy = false;
  export let enterStoryError = '';
  export let hasActiveSession = false;

  const dispatch = createEventDispatcher<{
    enterStory: void;
  }>();

  const phaseLabels = ['导入', '构建', '审阅', '游玩'];

  let workspace: ReviewWorkspaceController | null = null;
  let workspaceState: ReviewWorkspaceState | null = null;
  let unsubscribe: Unsubscriber | null = null;
  let workspaceProjectId = '';

  function attachWorkspace(nextProject: NovelProject) {
    unsubscribe?.();
    workspace = createReviewWorkspaceController(nextProject);
    unsubscribe = workspace.subscribe((value) => {
      workspaceState = value;
    });
    workspaceProjectId = nextProject.id;
  }

  function withWorkspace(action: (controller: ReviewWorkspaceController) => void | Promise<void>) {
    if (!workspace) return;
    void action(workspace);
  }

  $: if (project && project.id !== workspaceProjectId) {
    attachWorkspace(project);
  }

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<div class="review-stage-shell" data-testid="review-stage-shell">
  <header class="review-stage-topbar">
    <div class="topbar-copy">
      <p class="eyebrow">审阅</p>
      <strong>{project.name}</strong>
    </div>
    <PhaseStepper phase="review" labels={phaseLabels} />
  </header>

  <section class="review-stage-strip" data-testid="review-stage-strip">
    <div class="strip-copy">
      <p class="eyebrow">Review</p>
      <h2>先校正世界模型，再进入故事</h2>
      <p>
        这一轮可以轻量修改角色卡、世界书和规则。右侧预览会直接反映这些结构化结果如何影响
        lore 激活和规则判断。
      </p>
    </div>
    <button type="button" on:click={() => dispatch('enterStory')} disabled={busy}>
      {hasActiveSession ? '继续互动故事' : '进入互动故事'}
    </button>
  </section>

  {#if enterStoryError}
    <p class="review-stage-error" role="alert">{enterStoryError}</p>
  {/if}

  {#if workspaceState}
    <ReviewWorkspace
      state={workspaceState}
      on:setActiveSection={(event) =>
        withWorkspace((controller) => controller.setActiveSection(event.detail))}
      on:selectCharacter={(event) =>
        withWorkspace((controller) => controller.selectCharacter(event.detail))}
      on:selectWorldBookEntry={(event) =>
        withWorkspace((controller) => controller.selectWorldBookEntry(event.detail))}
      on:selectRule={(event) => withWorkspace((controller) => controller.selectRule(event.detail))}
      on:updateCharacterDraft={(event) =>
        withWorkspace((controller) => controller.updateCharacterDraft(event.detail))}
      on:updateWorldBookDraft={(event) =>
        withWorkspace((controller) => controller.updateWorldBookDraft(event.detail))}
      on:updateRuleDraft={(event) =>
        withWorkspace((controller) => controller.updateRuleDraft(event.detail))}
      on:updatePreviewContext={(event) =>
        withWorkspace((controller) => controller.updatePreviewContext(event.detail))}
      on:saveCharacter={() => withWorkspace((controller) => controller.saveCharacter())}
      on:saveWorldBook={() => withWorkspace((controller) => controller.saveWorldBook())}
      on:deleteWorldBook={() => withWorkspace((controller) => controller.deleteWorldBook())}
      on:saveRule={() => withWorkspace((controller) => controller.saveRule())}
      on:deleteRule={() => withWorkspace((controller) => controller.deleteRule())}
      on:refreshPreview={() => withWorkspace((controller) => controller.refreshPreview())}
    />
  {/if}
</div>

<style>
  .review-stage-shell {
    display: grid;
    gap: 12px;
    width: min(1440px, 100%);
    margin: 0 auto;
  }

  .review-stage-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    border-radius: 22px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(251, 247, 240, 0.8);
    box-shadow: 0 10px 22px rgba(70, 54, 39, 0.05);
  }

  .topbar-copy strong {
    display: block;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.26rem;
  }

  .review-stage-strip {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 16px 18px;
    border-radius: 20px;
    border: 1px solid rgba(121, 103, 81, 0.12);
    background: rgba(252, 249, 242, 0.8);
    box-shadow: 0 8px 18px rgba(65, 49, 35, 0.04);
  }

  .strip-copy h2 {
    margin: 0;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(1.45rem, 2.4vw, 2.1rem);
    color: #2f261d;
  }

  .strip-copy p {
    margin: 8px 0 0;
    max-width: 640px;
    line-height: 1.62;
    color: rgba(63, 47, 35, 0.74);
  }

  .review-stage-strip button {
    min-width: 180px;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    background: #1f6a57;
    color: #f6f3eb;
    cursor: pointer;
  }

  .review-stage-error {
    margin: 0;
    padding: 0 4px;
    color: #b14d3b;
    font-size: 0.88rem;
  }

  .eyebrow {
    margin: 0;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.68rem;
  }

  @media (max-width: 900px) {
    .review-stage-strip {
      flex-direction: column;
      align-items: stretch;
    }

    .review-stage-strip button {
      align-self: flex-start;
    }
  }
</style>
