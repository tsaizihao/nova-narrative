<script lang="ts">
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte';
  import type { AiProviderKind, AppAiSettingsSnapshot } from '$lib/types';
  import type { SavedProjectCardEntry } from '$lib/modules/projects/library';
  import { readImportedTextFile } from '$lib/text-import';

  export let projectName = '';
  export let novelText = '';
  export let busy = false;
  export let error = '';
  export let resumableProjects: SavedProjectCardEntry[] = [];
  export let aiSettings: AppAiSettingsSnapshot = {
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
  export let settingsPrompt = '';

  let novelTextarea: HTMLTextAreaElement | null = null;
  let selectedProvider: AiProviderKind = 'heuristic';
  let providerSnapshot = aiSettings.openai_compatible;
  let providerStatus = '离线模式，无需额外配置';
  let currentModelText = '未设置模型';
  let apiKeyStatus = '不需要';
  let buildDisabled = false;

  const MIN_TEXTAREA_HEIGHT = 320;
  const fieldBoxStyle = 'box-sizing: border-box; max-width: 100%;';

  const dispatch = createEventDispatcher<{
    submit: void;
    sample: void;
    fileError: string;
    fileLoaded: void;
    updateProjectName: string;
    updateNovelText: string;
    openSettings: void;
    openProject: string;
  }>();

  const providerLabels: Record<AiProviderKind, string> = {
    heuristic: '启发式（离线）',
    openai_compatible: 'OpenAI 标准兼容',
    openrouter: 'OpenRouter'
  };

  function syncNovelTextareaHeight(textarea = novelTextarea) {
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT)}px`;
  }

  function handleNovelTextInput(event: Event) {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    syncNovelTextareaHeight(textarea);
    dispatch('updateNovelText', textarea.value);
  }

  async function handleFileSelection(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const imported = await readImportedTextFile(file);
      if (!projectName.trim()) {
        dispatch('updateProjectName', imported.suggestedName);
      }
      dispatch('updateNovelText', imported.content);
      dispatch('fileLoaded');
    } catch (caught) {
      dispatch('fileError', caught instanceof Error ? caught.message : '读取 txt 文件失败');
    } finally {
      target.value = '';
    }
  }

  onMount(() => {
    syncNovelTextareaHeight();
  });

  afterUpdate(() => {
    syncNovelTextareaHeight();
  });

  $: selectedProvider = aiSettings.selected_provider;
  $: providerSnapshot =
    selectedProvider === 'openrouter' ? aiSettings.openrouter : aiSettings.openai_compatible;
  $: providerStatus =
    selectedProvider === 'heuristic'
      ? '离线模式，无需额外配置'
      : providerSnapshot.base_url.trim() &&
          providerSnapshot.model.trim() &&
          providerSnapshot.has_api_key
        ? '配置已就绪'
        : '配置未完成';
  $: currentModelText = providerSnapshot.model.trim() || '未设置模型';
  $: apiKeyStatus =
    selectedProvider === 'heuristic' ? '不需要' : providerSnapshot.has_api_key ? '已保存' : '未保存';
  $: buildDisabled = busy || !projectName.trim() || !novelText.trim();
</script>

<section class="import-layout">
  <div class="workspace-hero">
    <div class="support-rail">
      <div class="copy">
        <p class="eyebrow">Import</p>
        <h1>先导入小说，再让系统开始改编</h1>
        <p class="lede">
          把纯文本贴进来，下一步就是解析人物、世界、规则和可互动场景。
        </p>
        <p class="support-copy">
          审阅阶段还能继续校正角色、世界书和规则，然后再进入互动试玩。
        </p>
      </div>

      <section class="support-panel">
        <div>
          <p class="label">导入提示</p>
          <h3>优先粘贴完整章节正文</h3>
        </div>

        <div class="support-list">
          <article>
            <strong>保留章节标题与空行</strong>
            <p>这样更容易切分结构，也更利于后续生成起始场景。</p>
          </article>
          <article>
            <strong>优先粘贴完整章节正文</strong>
            <p>不要只贴设定摘要，正文里的行动和关系变化才是互动化的基础。</p>
          </article>
          <article>
            <strong>这一步会产出</strong>
            <p>角色卡、世界书和规则草案会在审阅阶段继续校正，不需要一次写完。</p>
          </article>
        </div>

        <div class="outcome-grid">
          <div>
            <span>角色卡</span>
            <strong>人物与动机</strong>
          </div>
          <div>
            <span>世界书</span>
            <strong>地点与设定</strong>
          </div>
          <div>
            <span>规则</span>
            <strong>约束与后果</strong>
          </div>
        </div>
      </section>
    </div>

    <div class="composer">
      <div class="section-head">
        <div>
          <p class="label">新项目</p>
          <h2>导入小说文本</h2>
        </div>
        <div class="head-actions">
          <label class="ghost file-trigger">
            <input type="file" accept=".txt,text/plain" on:change={handleFileSelection} disabled={busy} />
            <span>导入 .txt</span>
          </label>
          <button type="button" class="ghost" on:click={() => dispatch('sample')} disabled={busy}>
            载入示例
          </button>
        </div>
      </div>

      <p class="file-help">支持中文纯文本 `.txt`，读取成功后会直接填入下方文本框。</p>

      <label>
        <span>项目名称</span>
        <input
          style={fieldBoxStyle}
          value={projectName}
          on:input={(event) => dispatch('updateProjectName', event.currentTarget.value)}
          placeholder="例如：临川夜话"
          disabled={busy}
        />
      </label>

      <label>
        <span>小说正文</span>
        <textarea
          style={fieldBoxStyle}
          bind:this={novelTextarea}
          value={novelText}
          on:input={handleNovelTextInput}
          style:overflow-y="hidden"
          placeholder="粘贴 txt 或 markdown 纯文本内容"
          disabled={busy}
        ></textarea>
      </label>

      <section class="settings-summary">
        <div class="summary-head">
          <div>
            <p class="label">AI 设置</p>
            <h3>当前摘要</h3>
          </div>
          <button type="button" class="ghost quiet summary-action" on:click={() => dispatch('openSettings')}>
            去配置
          </button>
        </div>

        <div class="summary-grid">
          <article class="meta-block">
            <span>当前 Provider</span>
            <strong>{providerLabels[selectedProvider]}</strong>
          </article>
          <article class="meta-block">
            <span>接口状态</span>
            <strong class:status-ready={providerStatus === '配置已就绪' || selectedProvider === 'heuristic'}>
              {providerStatus}
            </strong>
          </article>
          <article class="meta-block">
            <span>当前模型</span>
            <strong>{currentModelText}</strong>
          </article>
          <article class="meta-block">
            <span>API key</span>
            <strong>{apiKeyStatus}</strong>
          </article>
        </div>

        {#if settingsPrompt.trim()}
          <p class="summary-hint">{settingsPrompt}</p>
        {/if}
      </section>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button
        type="button"
        class="primary"
        on:click={() => dispatch('submit')}
        disabled={buildDisabled}
      >
        {busy ? '故事准备中' : '开始解析与改编'}
      </button>
    </div>
  </div>
  {#if resumableProjects.length > 0}
    <section class="resume-panel resume-shelf">
      <div>
        <p class="label">继续已有项目</p>
        <h3>从上次构建好的故事继续</h3>
      </div>

      <div class="resume-list">
        {#each resumableProjects as resumableProject (resumableProject.project.id)}
          <article class="resume-item">
            <div>
              <strong>{resumableProject.project.name}</strong>
              <p>{resumableProject.activityLabel}</p>
              <p class="activity-time">
                <span class="activity-meta">
                  {resumableProject.activityMetaLabel ??
                    (resumableProject.sessionId ? '最近游玩' : '最近导入')}
                </span>
                <span>{resumableProject.activityTimeLabel}</span>
              </p>
            </div>
            <button
              type="button"
              class="ghost"
              on:click={() => dispatch('openProject', resumableProject.project.id)}
              disabled={busy}
            >
              {resumableProject.ctaLabel}
            </button>
          </article>
        {/each}
      </div>
    </section>
  {/if}
</section>

<style>
  .import-layout {
    display: grid;
    gap: 24px;
    align-content: start;
  }

  .workspace-hero {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }

  .support-rail {
    display: grid;
    gap: 18px;
    align-content: start;
  }

  .copy,
  .composer,
  .support-panel,
  .resume-panel {
    border-radius: 28px;
    border: 1px solid rgba(121, 103, 81, 0.14);
    background: rgba(248, 243, 234, 0.94);
    box-shadow: 0 18px 42px rgba(65, 49, 35, 0.08);
  }

  .copy {
    padding: 40px;
  }

  .composer {
    padding: 32px;
    display: grid;
    gap: 16px;
  }

  .support-panel {
    display: grid;
    gap: 18px;
    padding: 28px;
  }

  .resume-panel {
    display: grid;
    gap: 16px;
    padding: 24px 28px 28px;
  }

  .resume-shelf {
    width: 100%;
  }

  .eyebrow,
  .label {
    margin: 0 0 12px;
    color: #91765d;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
  }

  h1,
  h2,
  h3 {
    margin: 0;
    color: #2f261d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
  }

  h1 {
    max-width: 12ch;
    font-size: clamp(2.5rem, 4.2vw, 4rem);
    line-height: 1.06;
  }

  h2 {
    font-size: 1.8rem;
  }

  h3 {
    font-size: 1.15rem;
  }

  .lede {
    margin: 20px 0 0;
    max-width: 48ch;
    font-size: 1.02rem;
    line-height: 1.8;
    color: rgba(62, 48, 36, 0.8);
  }

  .support-copy {
    margin: 18px 0 0;
    max-width: 40ch;
    line-height: 1.7;
    color: rgba(62, 48, 36, 0.64);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .head-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }

  .file-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .file-trigger input {
    display: none;
  }

  .file-help {
    margin: -4px 0 0;
    color: rgba(92, 73, 55, 0.72);
    font-size: 0.9rem;
  }

  .support-list {
    display: grid;
    gap: 12px;
  }

  .support-list article {
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.56);
    border: 1px solid rgba(121, 103, 81, 0.08);
  }

  .support-list strong,
  .support-list p {
    display: block;
  }

  .support-list strong {
    color: #2f261d;
  }

  .support-list p {
    margin: 8px 0 0;
    line-height: 1.65;
    color: rgba(63, 47, 35, 0.68);
    font-size: 0.92rem;
  }

  .outcome-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .outcome-grid div {
    padding: 14px 14px 16px;
    border-radius: 18px;
    background: rgba(121, 103, 81, 0.06);
  }

  .resume-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .resume-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(121, 103, 81, 0.08);
  }

  .resume-item strong,
  .resume-item p {
    display: block;
  }

  .resume-item p {
    margin: 6px 0 0;
    color: rgba(63, 47, 35, 0.68);
    font-size: 0.92rem;
  }

  .activity-time {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .activity-meta {
    color: #91765d;
  }

  .outcome-grid span,
  .outcome-grid strong {
    display: block;
  }

  .outcome-grid span {
    color: #91765d;
    font-size: 0.78rem;
  }

  .outcome-grid strong {
    margin-top: 8px;
    color: #2f261d;
    font-size: 0.98rem;
  }

  label {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  label span {
    font-size: 0.82rem;
    color: rgba(63, 47, 35, 0.82);
  }

  input,
  textarea {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    border: 1px solid rgba(121, 103, 81, 0.16);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.92);
    color: #2f261d;
    font: inherit;
    padding: 14px 16px;
    resize: none;
  }

  input {
    min-height: 52px;
  }

  textarea {
    min-height: 320px;
    line-height: 1.72;
    overflow-y: hidden;
  }

  .settings-summary {
    display: grid;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 20px;
    background: rgba(121, 103, 81, 0.05);
    border: 1px solid rgba(121, 103, 81, 0.1);
  }

  .summary-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .meta-block {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border-radius: 16px;
    background: rgba(255, 253, 252, 0.9);
    border: 1px solid rgba(121, 103, 81, 0.08);
  }

  .meta-block span {
    color: rgba(92, 73, 55, 0.7);
    font-size: 0.82rem;
  }

  .meta-block strong {
    color: #2f261d;
    font-size: 0.94rem;
    line-height: 1.5;
  }

  .status-ready {
    color: #1f6a57;
  }

  .summary-action {
    padding-inline: 16px;
  }

  .summary-hint {
    margin: 0;
    color: rgba(92, 73, 55, 0.72);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .primary,
  .ghost {
    border: none;
    border-radius: 999px;
    font: inherit;
    cursor: pointer;
    transition:
      transform 160ms ease,
      opacity 160ms ease,
      background 160ms ease;
  }

  .primary {
    min-height: 54px;
    background: #1f6a57;
    color: #f6f3eb;
    font-weight: 700;
  }

  .ghost {
    padding: 11px 18px;
    background: rgba(121, 103, 81, 0.08);
    color: #5f4f3e;
  }

  .ghost.quiet {
    background: rgba(121, 103, 81, 0.04);
  }

  .primary:hover,
  .ghost:hover {
    transform: translateY(-1px);
  }

  .error {
    margin: 0;
    color: #b14d3b;
  }

  @media (max-width: 980px) {
    .import-layout {
      gap: 18px;
    }

    .workspace-hero {
      grid-template-columns: 1fr;
    }

    .copy,
    .composer,
    .support-panel {
      padding: 26px;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }

    .outcome-grid {
      grid-template-columns: 1fr;
    }

    .resume-list,
    .resume-item {
      grid-template-columns: 1fr;
    }
  }
</style>
