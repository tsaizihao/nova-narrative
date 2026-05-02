<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  import { normalizeCommandError } from '$lib/backend/commandClient';
  import BuildProgressScreen from '$lib/components/BuildProgressScreen.svelte';
  import ImportScreen from '$lib/components/ImportScreen.svelte';
  import ReviewStageShell from '$lib/components/ReviewStageShell.svelte';
  import RuntimeStageShell from '$lib/components/RuntimeStageShell.svelte';
  import WorkspaceTopbar from '$lib/components/WorkspaceTopbar.svelte';
  import {
    clearImportDraft,
    loadImportDraft,
    saveImportDraft
  } from '$lib/modules/import-draft/storage';
  import * as projectBackend from '$lib/modules/projects/backend';
  import { toSavedProjectCardEntry, type SavedProjectCardEntry } from '$lib/modules/projects/library';
  import * as runtimeBackend from '$lib/modules/runtime/backend';
  import * as settingsBackend from '$lib/modules/settings/backend';
  import {
    clearWorkspaceContext,
    loadWorkspaceContext,
    saveWorkspaceContext,
    type WorkspacePhase
  } from '$lib/modules/workspace-context/storage';
  import { resolveReaderLayoutMode, type ReaderLayoutMode } from '$lib/ui-layout';
  import { SAMPLE_NOVEL, SAMPLE_PROJECT_NAME } from '$lib/sample-novel';
  import type {
    AppAiSettingsSnapshot,
    BuildStatus,
    NovelProject,
    SessionStatus,
  } from '$lib/types';

  type Phase = WorkspacePhase;
  type StepperPhase = Phase;

  let phase: Phase = 'import';
  let stepperPhase: StepperPhase = 'import';
  let projectName = '';
  let novelText = '';
  let project: NovelProject | null = null;
  let resumableProjects: SavedProjectCardEntry[] = [];
  let readerLayoutMode: ReaderLayoutMode = 'desktop';
  let buildStatus: BuildStatus = {
    stage: 'created',
    message: '等待新的故事',
    progress: 0
  };
  let activeSessionId: string | null = null;
  let resumableSessionId: string | null = null;
  let resumableSessionStatus: SessionStatus | null = null;
  let error = '';
  let busy = false;
  let settingsPrompt = '';
  let aiSettings: AppAiSettingsSnapshot = {
    selected_provider: 'heuristic',
    openai_compatible: {
      base_url: '',
      model: '',
      has_api_key: false
    },
    openrouter: {
      base_url: 'https://openrouter.ai/api/v1',
      model: '',
      has_api_key: false
    }
  };
  let aiSettingsLoadPromise: Promise<void> | null = null;

  const phaseLabels = ['导入', '构建', '审阅', '游玩'];

  function normalizeImportedText(text: string) {
    return text
      .replaceAll('\r\n', '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  function findReusableProject(name: string, text: string) {
    const normalizedName = name.trim();
    const normalizedText = normalizeImportedText(text);

    return resumableProjects.find((entry) => {
      return (
        entry.project.name.trim() === normalizedName &&
        normalizeImportedText(entry.project.raw_text) === normalizedText
      );
    });
  }

  function normalizeSessionStatus(status?: SessionStatus | null): SessionStatus {
    return status ?? 'active';
  }

  function syncProjectSessionState(
    session: { session_id: string; status?: SessionStatus | null } | null | undefined
  ) {
    resumableSessionId = session?.session_id ?? null;
    resumableSessionStatus = session ? normalizeSessionStatus(session.status) : null;
  }

  function activeProviderSnapshot(snapshot: AppAiSettingsSnapshot) {
    return snapshot.selected_provider === 'openrouter'
      ? snapshot.openrouter
      : snapshot.openai_compatible;
  }

  function selectedProviderIsReady(snapshot: AppAiSettingsSnapshot) {
    if (snapshot.selected_provider === 'heuristic') return true;

    const provider = activeProviderSnapshot(snapshot);
    return (
      provider.base_url.trim().length > 0 &&
      provider.model.trim().length > 0 &&
      provider.has_api_key
    );
  }

  function persistImportDraft() {
    saveImportDraft({
      projectName,
      novelText,
      settingsPrompt: settingsPrompt || null
    });
  }

  function saveCurrentWorkspaceContext(currentPhase: WorkspacePhase) {
    saveWorkspaceContext({
      phase: currentPhase,
      projectId: project?.id ?? null,
      projectName: project?.name ?? projectName,
      sessionId: activeSessionId
    });
  }

  async function navigateToSettings(currentPhase: WorkspacePhase) {
    persistImportDraft();
    saveCurrentWorkspaceContext(currentPhase);
    await goto('/settings');
  }

  async function restoreWorkspaceContext() {
    const savedDraft = loadImportDraft();
    projectName = savedDraft.projectName;
    novelText = savedDraft.novelText;
    settingsPrompt = savedDraft.settingsPrompt ?? '';

    const context = loadWorkspaceContext();
    if (!context) return;

    if (context.phase === 'import' || !context.projectId) {
      clearWorkspaceContext();
      return;
    }

    const restoredProject = await projectBackend.getProject(context.projectId);
    project = restoredProject;
    projectName = restoredProject.name;
    buildStatus = restoredProject.build_status;
    activeSessionId = null;

    if (context.phase === 'reader' && context.sessionId) {
      syncProjectSessionState({
        session_id: context.sessionId,
        status: 'active'
      });
      activeSessionId = context.sessionId;
      phase = 'reader';
      clearWorkspaceContext();
      return;
    }

    if (context.phase === 'review') {
      syncProjectSessionState(await runtimeBackend.findProjectSession(restoredProject.id).catch(() => null));
      phase = 'review';
      clearWorkspaceContext();
      return;
    }

    if (restoredProject.build_status.stage === 'ready') {
      syncProjectSessionState(await runtimeBackend.findProjectSession(restoredProject.id).catch(() => null));
      phase = 'review';
    } else {
      syncProjectSessionState(null);
      phase = 'building';
    }

    clearWorkspaceContext();
  }

  async function loadAiSettings() {
    aiSettings = await settingsBackend.getAiSettings();
  }

  async function loadResumableProjects() {
    const entries = await projectBackend.listSavedProjects();
    resumableProjects = entries.map((entry) => toSavedProjectCardEntry(entry));
  }

  async function initializeStory() {
    if (!projectName.trim() || !novelText.trim()) return;

    if (aiSettingsLoadPromise) {
      await aiSettingsLoadPromise;
    }

    if (!selectedProviderIsReady(aiSettings)) {
      settingsPrompt = '当前模型尚未完成配置，请先补全 AI 设置。';
      await navigateToSettings('import');
      return;
    }

    const reusableProject = findReusableProject(projectName, novelText);
    if (reusableProject) {
      clearWorkspaceContext();
      await openExistingProject(reusableProject.project.id);
      return;
    }

    clearWorkspaceContext();
    busy = true;
    error = '';
    activeSessionId = null;
    syncProjectSessionState(null);
    let importedProject: NovelProject | null = null;

    try {
      project = await projectBackend.createProject(projectName.trim());
      clearImportDraft();
      importedProject = await projectBackend.importNovelText(project.id, novelText.trim());
      project = importedProject;

      phase = 'building';
      buildStatus = importedProject.build_status;

      buildStatus = await projectBackend.buildStoryPackage(project.id);
      project = await projectBackend.getProject(project.id);
      syncProjectSessionState(await runtimeBackend.findProjectSession(project.id).catch(() => null));
      error = '';
      phase = 'review';
    } catch (caught) {
      const commandError = normalizeCommandError(caught);
      error = commandError.message;

      if (importedProject) {
        phase = 'building';
        buildStatus = {
          stage: 'failed',
          message: '生成失败',
          progress: buildStatus.progress || importedProject.build_status.progress,
          error: commandError.message
        };
      } else {
        phase = 'import';
      }
    } finally {
      busy = false;
    }
  }

  async function openExistingProject(projectId: string) {
    const selectedProject = resumableProjects.find((candidate) => candidate.project.id === projectId);
    if (!selectedProject) {
      error = '未找到可继续的项目';
      return;
    }

    busy = true;
    error = '';
    activeSessionId = null;

    try {
      project = selectedProject.project;
      resumableSessionId = selectedProject.sessionId;
      resumableSessionStatus =
        selectedProject.sessionId == null
          ? null
          : selectedProject.activityKind === 'session'
            ? 'active'
            : 'finished';

      if (selectedProject.sessionId) {
        activeSessionId = selectedProject.sessionId;
        phase = 'reader';
      } else {
        phase = 'review';
      }
    } catch (caught) {
      project = null;
      activeSessionId = null;
      resumableSessionId = null;
      error = caught instanceof Error ? caught.message : '打开已有项目失败';
      phase = 'import';
    } finally {
      busy = false;
    }
  }

  async function enterStory() {
    if (!project) return;

    if (activeSessionId) {
      error = '';
      phase = 'reader';
      return;
    }

    if (resumableSessionId) {
      activeSessionId = resumableSessionId;
      error = '';
      phase = 'reader';
      return;
    }

    const resumableSession = await runtimeBackend
      .findProjectSession(project.id)
      .catch(() => null);
    if (resumableSession) {
      syncProjectSessionState(resumableSession);
      activeSessionId = resumableSession.session_id;
      error = '';
      phase = 'reader';
      return;
    }

    busy = true;
    error = '';

    try {
      const session = await runtimeBackend.startSession(project.id);
      activeSessionId = session.session_id;
      syncProjectSessionState(session);
      phase = 'reader';
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '启动阅读器失败';
    } finally {
      busy = false;
    }
  }

  function fillSample() {
    projectName = SAMPLE_PROJECT_NAME;
    novelText = SAMPLE_NOVEL;
    error = '';
  }

  async function returnToReview() {
    error = '';
    const previousSessionId = activeSessionId;
    activeSessionId = null;

    if (project) {
      const latestSession = await runtimeBackend.findProjectSession(project.id).catch(() => null);
      if (latestSession) {
        syncProjectSessionState(latestSession);
      } else if (previousSessionId) {
        syncProjectSessionState({
          session_id: previousSessionId,
          status: 'active'
        });
      } else {
        syncProjectSessionState(null);
      }
    }

    phase = 'review';
  }

  $: stepperPhase = phase;

  onMount(() => {
    const updateReaderLayout = () => {
      readerLayoutMode = resolveReaderLayoutMode(window.innerWidth);
    };

    aiSettingsLoadPromise = loadAiSettings()
      .catch((caught) => {
        error = caught instanceof Error ? caught.message : '加载 AI 设置失败';
      })
      .finally(() => {
        aiSettingsLoadPromise = null;
      });

    void loadResumableProjects().catch((caught) => {
      error = caught instanceof Error ? caught.message : '加载已有项目失败';
    });
    void restoreWorkspaceContext().catch((caught) => {
      error = caught instanceof Error ? caught.message : '恢复工作区失败';
    });
    updateReaderLayout();
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

  <div class="content-frame" data-phase={phase}>
    {#if phase === 'import' || phase === 'building'}
      <WorkspaceTopbar
        eyebrow="叙世者"
        title="小说改编工作台"
        metaLabel={project?.name ?? '单本项目制'}
        phase={stepperPhase}
        labels={phaseLabels}
        showStepper={true}
        showSettingsAction={true}
        settingsActive={false}
        on:openSettings={() => navigateToSettings(phase)}
      />
    {/if}

    {#if phase === 'import'}
      <ImportScreen
        {projectName}
        {novelText}
        {busy}
        {error}
        {resumableProjects}
        {aiSettings}
        {settingsPrompt}
        on:submit={initializeStory}
        on:sample={fillSample}
        on:fileLoaded={() => {
          error = '';
        }}
        on:fileError={(event) => {
          error = event.detail;
        }}
        on:updateProjectName={(event) => (projectName = event.detail)}
        on:updateNovelText={(event) => (novelText = event.detail)}
        on:openSettings={() => navigateToSettings('import')}
        on:openProject={(event) => openExistingProject(event.detail)}
      />
    {:else if phase === 'building'}
      <BuildProgressScreen projectName={project?.name ?? projectName} {buildStatus} />
    {:else if phase === 'review' && project}
      <ReviewStageShell
        {project}
        {busy}
        hasActiveSession={resumableSessionStatus === 'active'}
        enterStoryError={error}
        on:enterStory={enterStory}
      />
    {:else if phase === 'reader' && activeSessionId}
      <RuntimeStageShell
        sessionId={activeSessionId}
        projectName={project?.name ?? projectName}
        layoutMode={readerLayoutMode}
        on:exitReader={returnToReview}
      />
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    min-height: 100vh;
    overflow-x: hidden;
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
  }

  .content-frame {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 22px;
    width: min(1280px, 100%);
    margin: 0 auto;
  }

  .content-frame[data-phase='review'] {
    width: min(1440px, 100%);
  }

  .content-frame[data-phase='reader'],
  .content-frame[data-phase='ending'] {
    width: min(1360px, 100%);
    min-height: calc(100vh - 56px);
  }

  .content-frame[data-phase='reader'] {
    height: calc(100vh - 56px);
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

  @media (max-width: 900px) {
    .page-shell {
      padding: 18px;
    }

    .content-frame[data-phase='reader'],
    .content-frame[data-phase='ending'] {
      min-height: calc(100vh - 36px);
    }

    .content-frame[data-phase='reader'] {
      height: calc(100vh - 36px);
    }
  }
</style>
