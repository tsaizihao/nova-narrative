<script lang="ts">
  import BuildProgressScreen from '$lib/components/BuildProgressScreen.svelte';
  import CharacterReviewPanel from '$lib/components/CharacterReviewPanel.svelte';
  import EndingScreen from '$lib/components/EndingScreen.svelte';
  import ImportScreen from '$lib/components/ImportScreen.svelte';
  import ReaderStage from '$lib/components/ReaderStage.svelte';
  import RuleBookPanel from '$lib/components/RuleBookPanel.svelte';
  import StoryCodexPanel from '$lib/components/StoryCodexPanel.svelte';
  import StoryStatePanel from '$lib/components/StoryStatePanel.svelte';
  import WorldBookPanel from '$lib/components/WorldBookPanel.svelte';
  import { loreLifecycleTone, loreSlotLabel, ruleBadgeTone } from '$lib/rule-helpers';
  import { api } from '$lib/api/client';
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

  let phase: Phase = 'import';
  let projectName = SAMPLE_PROJECT_NAME;
  let novelText = SAMPLE_NOVEL;
  let project: NovelProject | null = null;
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

  const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

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
</script>

<svelte:head>
  <title>Nova Narrative</title>
</svelte:head>

<div class="page-shell">
  <div class="page-glow page-glow-left"></div>
  <div class="page-glow page-glow-right"></div>

  <header class="topbar">
    <div>
      <p>Nova Narrative</p>
      <strong>AI 互动视觉小说阅读器</strong>
    </div>
    <span>{project?.name ?? '单本项目制'}</span>
  </header>

  {#if phase === 'import'}
    <ImportScreen
      {projectName}
      {novelText}
      {busy}
      {error}
      on:submit={initializeStory}
      on:sample={fillSample}
      on:updateProjectName={(event) => (projectName = event.detail)}
      on:updateNovelText={(event) => (novelText = event.detail)}
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

      <div class="preview-grid">
        <article>
          <strong>lore 预览</strong>
          <div class="preview-list">
            {#each lorePreview as lore}
              <div class="preview-item">
                <p>{lore.title}</p>
                <span class={`tone-${loreLifecycleTone(lore.lifecycle_state)}`}>
                  {loreSlotLabel(lore.slot)} · {lore.reason}
                </span>
              </div>
            {/each}
          </div>
        </article>
        <article>
          <strong>规则预览</strong>
          <div class="preview-list">
            {#if rulePreview}
              {#each rulePreview.active_rules as rule}
                <div class="preview-item">
                  <p>{rule.name}</p>
                  <span class={`tone-${ruleBadgeTone(rule.priority)}`}>{rule.explanation}</span>
                </div>
              {/each}
              <p class="subtle">
                预测状态：{rulePreview.story_state.possibility_flags.length
                  ? rulePreview.story_state.possibility_flags.join(' / ')
                  : rulePreview.story_state.event_flags.join(' / ') || '暂无变化'}
              </p>
            {/if}
          </div>
        </article>
      </div>

      {#if error}
        <p class="error review-error">{error}</p>
      {/if}

      <div class="review-grid">
        <CharacterReviewPanel cards={project.character_cards} on:save={saveCharacter} />
        <WorldBookPanel entries={project.worldbook_entries} on:save={saveWorldBook} on:remove={deleteWorldBook} />
        <RuleBookPanel rules={project.rules} on:save={saveRule} on:remove={deleteRule} />
      </div>
    </div>
  {:else if phase === 'reader' && payload && activeSession}
    <div class="reader-grid">
      <ReaderStage
        {payload}
        {busy}
        {error}
        {freeInput}
        on:choose={(event) => choose(event.detail)}
        on:freeInputChange={(event) => (freeInput = event.detail)}
        on:submitFreeInput={submitFreeInput}
      />
      <StoryCodexPanel
        {codex}
        session={activeSession}
        activeLore={payload.active_lore}
        activeRules={payload.active_rules}
        on:rewind={(event) => rewind(event.detail)}
      />
      <StoryStatePanel storyState={payload.story_state} activeRules={payload.active_rules} />
    </div>
  {:else if phase === 'ending' && payload && activeSession && payload.session.ending_report}
    <EndingScreen ending={payload.session.ending_report} session={activeSession} on:rewind={(event) => rewind(event.detail)} />
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at top, rgba(199, 160, 98, 0.2), transparent 30%),
      linear-gradient(160deg, #120f0d 0%, #201612 45%, #40261a 100%);
    color: #f3ead8;
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
    background: rgba(207, 153, 74, 0.2);
  }

  .page-glow-right {
    inset: 120px -60px auto auto;
    width: 280px;
    height: 280px;
    background: rgba(89, 49, 28, 0.35);
  }

  .topbar {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin: 0 auto 22px;
    width: min(1440px, 100%);
    padding: 16px 20px;
    border-radius: 20px;
    border: 1px solid rgba(255, 243, 214, 0.08);
    background: rgba(15, 11, 8, 0.55);
    backdrop-filter: blur(18px);
  }

  .topbar p,
  .topbar strong,
  .topbar span {
    margin: 0;
  }

  .topbar p {
    font-size: 0.72rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #d2b37b;
  }

  .topbar strong {
    display: block;
    margin-top: 5px;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: 1.35rem;
  }

  .topbar span {
    color: rgba(255, 243, 214, 0.68);
    font-size: 0.9rem;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #d3b37b;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.68rem;
  }

  .review-shell,
  .reader-grid {
    position: relative;
    z-index: 1;
    width: min(1440px, 100%);
    margin: 0 auto;
  }

  .review-shell {
    display: grid;
    gap: 18px;
  }

  .review-hero,
  .preview-grid article {
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(255, 243, 214, 0.1);
    background: rgba(14, 11, 9, 0.82);
  }

  .review-hero {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  .review-hero h2,
  .review-hero p,
  .preview-grid p,
  .preview-grid strong {
    margin: 0;
  }

  .review-hero h2 {
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .review-hero p:last-child {
    margin-top: 12px;
    max-width: 760px;
    line-height: 1.7;
    color: rgba(255, 243, 214, 0.76);
  }

  .review-hero button {
    min-width: 180px;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1px solid rgba(255, 227, 170, 0.22);
    background: linear-gradient(135deg, rgba(204, 150, 70, 0.22), rgba(255, 229, 178, 0.12));
    color: #fff4dd;
    cursor: pointer;
  }

  .preview-grid,
  .review-grid {
    display: grid;
    gap: 18px;
  }

  .preview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .review-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .preview-list {
    margin-top: 14px;
    display: grid;
    gap: 12px;
  }

  .preview-item {
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(28, 20, 15, 0.88);
    border: 1px solid rgba(255, 238, 207, 0.06);
  }

  .preview-item p {
    margin: 0 0 6px;
  }

  .preview-item span,
  .subtle {
    color: rgba(255, 243, 214, 0.7);
    font-size: 0.82rem;
  }

  .reader-grid {
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr) minmax(280px, 0.8fr);
  }

  .review-error,
  .error {
    color: #ffb7a5;
  }

  .tone-danger {
    color: #ffb7a5;
  }

  .tone-warning {
    color: #f4cf90;
  }

  .tone-accent,
  .tone-success {
    color: #bfe5db;
  }

  .tone-muted {
    color: rgba(255, 243, 214, 0.6);
  }

  @media (max-width: 1200px) {
    .review-grid,
    .reader-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 900px) {
    .page-shell {
      padding: 18px;
    }

    .preview-grid {
      grid-template-columns: 1fr;
    }

    .review-hero {
      grid-template-columns: 1fr;
      display: grid;
    }
  }
</style>
