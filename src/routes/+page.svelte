<script lang="ts">
  import { onMount } from 'svelte';

  import BuildProgressScreen from '$lib/components/BuildProgressScreen.svelte';
  import EndingScreen from '$lib/components/EndingScreen.svelte';
  import ImportScreen from '$lib/components/ImportScreen.svelte';
  import ReaderDesktopShell from '$lib/components/ReaderDesktopShell.svelte';
  import ReaderMobileShell from '$lib/components/ReaderMobileShell.svelte';
  import ReviewStageShell from '$lib/components/ReviewStageShell.svelte';
  import WorkspaceTopbar from '$lib/components/WorkspaceTopbar.svelte';
  import { api } from '$lib/api/client';
  import { resolveReaderLayoutMode, type ReaderLayoutMode } from '$lib/ui-layout';
  import { SAMPLE_NOVEL, SAMPLE_PROJECT_NAME } from '$lib/sample-novel';
  import type {
    AiProviderKind,
    ActiveLoreEntry,
    AppAiSettingsSnapshot,
    BuildStatus,
    CharacterCard,
    NovelProject,
    RuleDefinition,
    RuleEvaluationResult,
    SaveAiSettingsInput,
    ScenePayload,
    SessionState,
    StoryCodex,
    WorldBookEntry
  } from '$lib/types';

  type Phase = 'import' | 'building' | 'review' | 'reader' | 'ending';
  type StepperPhase = Exclude<Phase, 'ending'>;

  let phase: Phase = 'import';
  let stepperPhase: StepperPhase = 'import';
  let projectName = SAMPLE_PROJECT_NAME;
  let novelText = SAMPLE_NOVEL;
  let project: NovelProject | null = null;
  let readerLayoutMode: ReaderLayoutMode = 'desktop';
  let buildStatus: BuildStatus = {
    stage: 'created',
    message: '等待新的故事',
    progress: 0
  };
  let payload: ScenePayload | null = null;
  let codex: StoryCodex | null = null;
  let activeSession: SessionState | null = null;
  let reviewSceneId = '';
  let lorePreview: ActiveLoreEntry[] = [];
  let rulePreview: RuleEvaluationResult | null = null;
  let error = '';
  let freeInput = '';
  let busy = false;
  let settingsBusy = false;
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
  let aiDraft: SaveAiSettingsInput = {
    selected_provider: 'heuristic',
    openai_compatible: {
      base_url: '',
      model: '',
      api_key: ''
    },
    openrouter: {
      base_url: 'https://openrouter.ai/api/v1',
      model: '',
      api_key: ''
    }
  };

  const phaseLabels = ['导入', '构建', '审阅', '游玩'];
  const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

  function syncAiDraft(snapshot: AppAiSettingsSnapshot) {
    aiDraft = {
      selected_provider: snapshot.selected_provider,
      openai_compatible: {
        base_url: snapshot.openai_compatible.base_url,
        model: snapshot.openai_compatible.model,
        api_key: ''
      },
      openrouter: {
        base_url: snapshot.openrouter.base_url || 'https://openrouter.ai/api/v1',
        model: snapshot.openrouter.model,
        api_key: ''
      }
    };
  }

  async function loadAiSettings() {
    aiSettings = await api.getAiSettings();
    syncAiDraft(aiSettings);
  }

  function updateAiProvider(provider: AiProviderKind) {
    aiDraft = {
      ...aiDraft,
      selected_provider: provider,
      openrouter: {
        ...aiDraft.openrouter,
        base_url: aiDraft.openrouter.base_url || 'https://openrouter.ai/api/v1'
      }
    };
  }

  function updateActiveAiField(field: 'base_url' | 'model' | 'api_key', value: string) {
    if (aiDraft.selected_provider === 'openrouter') {
      aiDraft = {
        ...aiDraft,
        openrouter: {
          ...aiDraft.openrouter,
          [field]: value
        }
      };
      return;
    }

    aiDraft = {
      ...aiDraft,
      openai_compatible: {
        ...aiDraft.openai_compatible,
        [field]: value
      }
    };
  }

  async function persistAiSettings() {
    settingsBusy = true;
    error = '';

    try {
      aiSettings = await api.saveAiSettings(aiDraft);
      syncAiDraft(aiSettings);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '保存 AI 接口设置失败';
    } finally {
      settingsBusy = false;
    }
  }

  async function clearProviderApiKey(provider: AiProviderKind) {
    if (provider === 'heuristic') return;

    settingsBusy = true;
    error = '';

    try {
      aiSettings = await api.clearProviderApiKey(provider);
      syncAiDraft(aiSettings);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '清除 API key 失败';
    } finally {
      settingsBusy = false;
    }
  }

  async function refreshCodex(sessionId: string) {
    codex = await api.getStoryCodex(sessionId);
  }

  async function refreshReviewData(projectId: string) {
    project = await api.getProject(projectId);
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

  $: stepperPhase = phase === 'ending' ? 'reader' : phase;

  onMount(() => {
    const updateReaderLayout = () => {
      readerLayoutMode = resolveReaderLayoutMode(window.innerWidth);
    };

    void loadAiSettings().catch((caught) => {
      error = caught instanceof Error ? caught.message : '加载 AI 设置失败';
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
    {#if phase !== 'review'}
      <WorkspaceTopbar
        eyebrow={phase === 'reader' || phase === 'ending' ? 'reader' : '叙世者'}
        title={phase === 'reader' || phase === 'ending' ? '互动故事' : '小说改编工作台'}
        metaLabel={project?.name ?? '单本项目制'}
        phase={stepperPhase}
        labels={phaseLabels}
        showStepper={phase !== 'reader' && phase !== 'ending'}
      />
    {/if}

    {#if phase === 'import'}
      <ImportScreen
        {projectName}
        {novelText}
        {busy}
        {error}
        {aiSettings}
        {aiDraft}
        {settingsBusy}
        on:submit={initializeStory}
        on:sample={fillSample}
        on:updateProjectName={(event) => (projectName = event.detail)}
        on:updateNovelText={(event) => (novelText = event.detail)}
        on:updateAiProvider={(event) => updateAiProvider(event.detail)}
        on:updateAiBaseUrl={(event) => updateActiveAiField('base_url', event.detail)}
        on:updateAiModel={(event) => updateActiveAiField('model', event.detail)}
        on:updateAiApiKey={(event) => updateActiveAiField('api_key', event.detail)}
        on:saveAiSettings={persistAiSettings}
        on:clearProviderApiKey={(event) => clearProviderApiKey(event.detail)}
      />
    {:else if phase === 'building'}
      <BuildProgressScreen projectName={project?.name ?? projectName} {buildStatus} />
    {:else if phase === 'review' && project}
      <ReviewStageShell
        {project}
        {lorePreview}
        {rulePreview}
        {error}
        {busy}
        on:enterStory={enterStory}
        on:saveCharacter={saveCharacter}
        on:saveWorldBook={saveWorldBook}
        on:deleteWorldBook={deleteWorldBook}
        on:saveRule={saveRule}
        on:deleteRule={deleteRule}
      />
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
  }
</style>
