<script lang="ts">
  import { onMount } from 'svelte';

  import BuildProgressScreen from '$lib/components/BuildProgressScreen.svelte';
  import EndingScreen from '$lib/components/EndingScreen.svelte';
  import ImportScreen from '$lib/components/ImportScreen.svelte';
  import PhaseStepper from '$lib/components/PhaseStepper.svelte';
  import ReaderDesktopShell from '$lib/components/ReaderDesktopShell.svelte';
  import ReaderMobileShell from '$lib/components/ReaderMobileShell.svelte';
  import ReviewWorkspace from '$lib/components/ReviewWorkspace.svelte';
  import { api } from '$lib/api/client';
  import { resolveReaderLayoutMode, type ReaderLayoutMode } from '$lib/ui-layout';
  import { SAMPLE_NOVEL, SAMPLE_PROJECT_NAME } from '$lib/sample-novel';
  import type {
    ActiveLoreEntry,
    BuildStatus,
    CharacterCard,
    NovelProject,
    RuleDefinition,
    RuleEvaluationResult,
    ScenePayload,
    SessionState,
    StoryCodex,
    WorldBookEntry
  } from '$lib/types';

  type Phase = 'import' | 'building' | 'review' | 'reader' | 'ending';
  type StepperPhase = Exclude<Phase, 'ending'>;

  let phase: Phase = 'import';
  let stepperPhase: StepperPhase = 'import';
  let projectName = '';
  let novelText = '';
  let project: NovelProject | null = null;
  let readerLayoutMode: ReaderLayoutMode = 'desktop';
  let buildStatus = createIdleBuildStatus();
  let payload: ScenePayload | null = null;
  let codex: StoryCodex | null = null;
  let activeSession: SessionState | null = null;
  let reviewSceneId = '';
  let lorePreview: ActiveLoreEntry[] = [];
  let rulePreview: RuleEvaluationResult | null = null;
  let error = '';
  let freeInput = '';
  let busy = false;

  const phaseLabels = ['导入', '构建', '审阅', '游玩'];
  const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

  function createIdleBuildStatus(): BuildStatus {
    return {
      stage: 'created',
      message: '等待导入中文小说',
      progress: 0
    };
  }

  function clearRuntimeState() {
    payload = null;
    codex = null;
    activeSession = null;
    reviewSceneId = '';
    lorePreview = [];
    rulePreview = null;
    freeInput = '';
  }

  function openImportDraft(name: string, text: string, clearProject = false) {
    if (clearProject) {
      project = null;
    }
    clearRuntimeState();
    phase = 'import';
    buildStatus = createIdleBuildStatus();
    projectName = name;
    novelText = text;
  }

  function startFreshProject() {
    error = '';
    openImportDraft('', '', true);
  }

  function reopenImportDraft() {
    error = '';
    openImportDraft(project?.name ?? projectName, project?.raw_text ?? novelText);
  }

  async function refreshCodex(sessionId: string) {
    codex = await api.getStoryCodex(sessionId);
  }

  async function refreshReviewData(projectId: string, existingProject?: NovelProject) {
    project = existingProject ?? (await api.getProject(projectId));
    reviewSceneId = project.story_package?.start_scene_id ?? '';
    if (!reviewSceneId) {
      lorePreview = [];
      rulePreview = null;
      return;
    }

    lorePreview = await api.previewActiveWorldbook(projectId, reviewSceneId, '我在门前犹豫');
    rulePreview = await api.previewRuleEvaluation(
      projectId,
      reviewSceneId,
      'open_gate',
      undefined,
      undefined,
      '午夜去开门'
    );
  }

  async function restoreRecentProject() {
    busy = true;
    error = '';

    try {
      const recentProject = await api.getRecentProject();
      if (!recentProject) {
        openImportDraft('', '', true);
        return;
      }

      const restoredProject = await api.getProject(recentProject.id);
      project = restoredProject;

      if (recentProject.has_story_package && restoredProject.story_package) {
        buildStatus = restoredProject.build_status;
        await refreshReviewData(restoredProject.id, restoredProject);
        phase = 'review';
        return;
      }

      openImportDraft(restoredProject.name, restoredProject.raw_text);
    } catch (caught) {
      openImportDraft('', '', true);
      error = caught instanceof Error ? `恢复最近项目失败：${caught.message}` : '恢复最近项目失败，已回到空白导入页';
    } finally {
      busy = false;
    }
  }

  async function initializeStory() {
    if (!projectName.trim() || !novelText.trim()) return;

    busy = true;
    error = '';

    try {
      project = await api.createProject(projectName.trim());
      project = await api.importNovelText(project.id, novelText.trim());

      phase = 'building';
      buildStatus = {
        stage: 'imported',
        message: 'Novel imported',
        progress: 20
      };

      const buildPromise = api.buildStoryPackage(project.id);
      await sleep(260);
      buildStatus = {
        stage: 'analyzing',
        message: 'AI 正在解析人物、关系与规则',
        progress: 45
      };
      await sleep(320);
      buildStatus = {
        stage: 'compiling',
        message: 'AI 正在编译互动场景',
        progress: 80
      };

      buildStatus = await buildPromise;
      await refreshReviewData(project.id);
      phase = 'review';
    } catch (caught) {
      phase = 'import';
      buildStatus = {
        stage: 'failed',
        message: '生成失败',
        progress: 0,
        error: caught instanceof Error ? caught.message : '未知错误'
      };
      error = buildStatus.error ?? '生成失败';
    } finally {
      busy = false;
    }
  }

  async function enterStory() {
    if (!project) return;

    busy = true;
    error = '';

    try {
      activeSession = await api.startSession(project.id);
      payload = await api.getCurrentScene(activeSession.session_id);
      activeSession = payload.session;
      await refreshCodex(activeSession.session_id);
      phase = payload.session.ending_report ? 'ending' : 'reader';
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '启动阅读器失败';
    } finally {
      busy = false;
    }
  }

  async function choose(choiceId: string) {
    if (!activeSession) return;

    busy = true;
    error = '';

    try {
      payload = await api.submitChoice(activeSession.session_id, choiceId);
      activeSession = payload.session;
      await refreshCodex(activeSession.session_id);
      if (payload.session.ending_report) {
        phase = 'ending';
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '推进剧情失败';
    } finally {
      busy = false;
    }
  }

  async function submitFreeInput() {
    if (!activeSession || !freeInput.trim()) return;

    busy = true;
    error = '';

    try {
      payload = await api.submitFreeInput(activeSession.session_id, freeInput.trim());
      activeSession = payload.session;
      await refreshCodex(activeSession.session_id);
      freeInput = '';
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '写入自由行动失败';
    } finally {
      busy = false;
    }
  }

  async function rewind(checkpointId: string) {
    if (!activeSession) return;

    busy = true;
    error = '';

    try {
      payload = await api.rewindToCheckpoint(activeSession.session_id, checkpointId);
      activeSession = payload.session;
      await refreshCodex(activeSession.session_id);
      phase = 'reader';
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '回溯失败';
    } finally {
      busy = false;
    }
  }

  async function saveCharacter(event: CustomEvent<CharacterCard>) {
    if (!project) return;
    busy = true;
    error = '';
    try {
      await api.updateCharacterCard(project.id, event.detail);
      await refreshReviewData(project.id);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '保存角色失败';
    } finally {
      busy = false;
    }
  }

  async function saveWorldBook(event: CustomEvent<WorldBookEntry>) {
    if (!project) return;
    busy = true;
    error = '';
    try {
      await api.upsertWorldBookEntry(project.id, event.detail);
      await refreshReviewData(project.id);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '保存世界书失败';
    } finally {
      busy = false;
    }
  }

  async function deleteWorldBook(event: CustomEvent<string>) {
    if (!project) return;
    busy = true;
    error = '';
    try {
      await api.deleteWorldBookEntry(project.id, event.detail);
      await refreshReviewData(project.id);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '删除世界书失败';
    } finally {
      busy = false;
    }
  }

  async function saveRule(event: CustomEvent<RuleDefinition>) {
    if (!project) return;
    busy = true;
    error = '';
    try {
      await api.upsertRule(project.id, event.detail);
      await refreshReviewData(project.id);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '保存规则失败';
    } finally {
      busy = false;
    }
  }

  async function deleteRule(event: CustomEvent<string>) {
    if (!project) return;
    busy = true;
    error = '';
    try {
      await api.deleteRule(project.id, event.detail);
      await refreshReviewData(project.id);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '删除规则失败';
    } finally {
      busy = false;
    }
  }

  function fillSample() {
    projectName = SAMPLE_PROJECT_NAME;
    novelText = SAMPLE_NOVEL;
    error = '';
  }

  function updateProjectName(value: string) {
    projectName = value;
    error = '';
  }

  function updateNovelText(value: string) {
    novelText = value;
    error = '';
  }

  $: stepperPhase = phase === 'ending' ? 'reader' : phase;

  onMount(() => {
    const updateReaderLayout = () => {
      readerLayoutMode = resolveReaderLayoutMode(window.innerWidth);
    };

    updateReaderLayout();
    void restoreRecentProject();
    window.addEventListener('resize', updateReaderLayout);

    return () => window.removeEventListener('resize', updateReaderLayout);
  });
</script>

<svelte:head>
  <title>叙世者</title>
</svelte:head>

<div class="page-shell">
  <div class="page-glow page-glow-left"></div>
  <div class="page-glow page-glow-right"></div>

  <header class="topbar">
    <div class="brand">
      <p>叙世者</p>
      <strong>“叙述世界的人” AI 帮你搭台</strong>
    </div>
    <div class="topbar-meta">
      <div class="topbar-actions">
        <button type="button" class="topbar-button" on:click={startFreshProject} disabled={busy}>
          新建项目
        </button>
        <button
          type="button"
          class="topbar-button topbar-button-secondary"
          on:click={reopenImportDraft}
          disabled={busy || (!project && !projectName && !novelText)}
        >
          重新导入
        </button>
      </div>
      <span>{project?.name ?? 'macOS 内部 Alpha'}</span>
      <PhaseStepper phase={stepperPhase} labels={phaseLabels} />
    </div>
  </header>

  {#if phase === 'import'}
    <ImportScreen
      {projectName}
      {novelText}
      {busy}
      {error}
      on:submit={initializeStory}
      on:sample={fillSample}
      on:fileLoaded={() => (error = '')}
      on:fileError={(event) => (error = event.detail)}
      on:updateProjectName={(event) => updateProjectName(event.detail)}
      on:updateNovelText={(event) => updateNovelText(event.detail)}
    />
  {:else if phase === 'building'}
    <BuildProgressScreen projectName={project?.name ?? projectName} {buildStatus} />
  {:else if phase === 'review' && project}
    <div class="review-shell">
      <section class="review-hero">
        <div>
          <p class="eyebrow">Review Stage</p>
          <h2>先校正世界模型，再进入故事</h2>
          <p>
            这一轮可以轻量修改角色卡、世界书和规则。右侧预览会直接反映这些结构化结果如何影响
            lore 激活和规则判断。
          </p>
        </div>
        <button type="button" on:click={enterStory} disabled={busy}>进入互动故事</button>
      </section>
      <ReviewWorkspace
        {project}
        {lorePreview}
        {rulePreview}
        {error}
        on:saveCharacter={saveCharacter}
        on:saveWorldBook={saveWorldBook}
        on:deleteWorldBook={deleteWorldBook}
        on:saveRule={saveRule}
        on:deleteRule={deleteRule}
      />
    </div>
  {:else if phase === 'reader' && payload && activeSession}
    {#if readerLayoutMode === 'desktop'}
      <ReaderDesktopShell
        {payload}
        codex={codex}
        session={activeSession}
        {freeInput}
        {busy}
        {error}
        on:choose={(event) => choose(event.detail)}
        on:freeInputChange={(event) => (freeInput = event.detail)}
        on:submitFreeInput={submitFreeInput}
        on:rewind={(event) => rewind(event.detail)}
      />
    {:else}
      <ReaderMobileShell
        {payload}
        codex={codex}
        {freeInput}
        {busy}
        {error}
        on:choose={(event) => choose(event.detail)}
        on:freeInputChange={(event) => (freeInput = event.detail)}
        on:submitFreeInput={submitFreeInput}
        on:rewind={(event) => rewind(event.detail)}
      />
    {/if}
  {:else if phase === 'ending' && payload && activeSession && payload.session.ending_report}
    <EndingScreen ending={payload.session.ending_report} session={activeSession} on:rewind={(event) => rewind(event.detail)} />
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at top, rgba(215, 194, 166, 0.4), transparent 30%),
      linear-gradient(180deg, #f6f1e8 0%, #efe7da 100%);
    color: #2f261d;
    font-family: 'IBM Plex Sans', 'PingFang SC', sans-serif;
  }

  :global(button),
  :global(input),
  :global(textarea),
  :global(select) {
    font-family: inherit;
  }

  .page-shell {
    position: relative;
    min-height: 100vh;
    padding: 28px;
    overflow: hidden;
  }

  .page-glow {
    position: absolute;
    border-radius: 999px;
    filter: blur(80px);
    opacity: 0.6;
    pointer-events: none;
  }

  .page-glow-left {
    inset: 0 auto auto -100px;
    width: 320px;
    height: 320px;
    background: rgba(218, 196, 160, 0.34);
  }

  .page-glow-right {
    inset: 120px -60px auto auto;
    width: 280px;
    height: 280px;
    background: rgba(181, 149, 113, 0.18);
  }

  .topbar {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin: 0 auto 22px;
    width: min(1280px, 100%);
    padding: 16px 20px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(250, 246, 239, 0.86);
    box-shadow: 0 16px 36px rgba(70, 54, 39, 0.08);
    backdrop-filter: blur(14px);
  }

  .brand {
    display: grid;
    gap: 4px;
  }

  .topbar p,
  .topbar strong,
  .topbar span {
    margin: 0;
  }

  .topbar p {
    font-size: 0.92rem;
    letter-spacing: 0.16em;
    color: #91765d;
  }

  .topbar strong {
    display: block;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.2rem;
  }

  .topbar-meta {
    display: grid;
    justify-items: end;
    gap: 12px;
  }

  .topbar-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .topbar span {
    color: rgba(63, 47, 35, 0.64);
    font-size: 0.9rem;
  }

  .topbar-button {
    min-height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: 999px;
    background: #1f6a57;
    color: #f6f3eb;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .topbar-button-secondary {
    background: rgba(121, 103, 81, 0.1);
    color: #5f4f3e;
    font-weight: 600;
  }

  .topbar-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.68rem;
  }

  .review-shell {
    position: relative;
    z-index: 1;
    width: min(1440px, 100%);
    margin: 0 auto;
  }

  .review-shell {
    display: grid;
    gap: 18px;
  }

  .review-hero {
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.94);
    box-shadow: 0 14px 28px rgba(65, 49, 35, 0.06);
  }

  .review-hero {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  .review-hero h2,
  .review-hero p {
    margin: 0;
  }

  .review-hero h2 {
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .review-hero p:last-child {
    margin-top: 12px;
    max-width: 760px;
    line-height: 1.7;
    color: rgba(63, 47, 35, 0.74);
  }

  .review-hero button {
    min-width: 180px;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    background: #1f6a57;
    color: #f6f3eb;
    cursor: pointer;
  }

  @media (max-width: 1200px) {
    .topbar {
      display: grid;
      grid-template-columns: 1fr;
      align-items: flex-start;
    }

    .topbar-meta {
      justify-items: start;
    }

    .topbar-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 900px) {
    .page-shell {
      padding: 18px;
    }

    .review-hero {
      grid-template-columns: 1fr;
      display: grid;
    }
  }
</style>
