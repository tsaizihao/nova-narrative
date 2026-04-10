<script lang="ts">
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte';
  import type { AiProviderKind, AppAiSettingsSnapshot, SaveAiSettingsInput } from '$lib/types';

  export let projectName = '';
  export let novelText = '';
  export let busy = false;
  export let error = '';
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
  export let aiDraft: SaveAiSettingsInput = {
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
  export let settingsBusy = false;

  let novelTextarea: HTMLTextAreaElement | null = null;
  let selectedProvider: AiProviderKind = 'heuristic';
  let activeSnapshot = aiSettings.openai_compatible;
  let activeDraft = aiDraft.openai_compatible;
  let externalProviderIncomplete = false;
  let buildDisabled = false;

  const MIN_TEXTAREA_HEIGHT = 320;

  const dispatch = createEventDispatcher<{
    submit: void;
    sample: void;
    updateProjectName: string;
    updateNovelText: string;
    updateAiProvider: AiProviderKind;
    updateAiBaseUrl: string;
    updateAiModel: string;
    updateAiApiKey: string;
    saveAiSettings: void;
    clearProviderApiKey: AiProviderKind;
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

  onMount(() => {
    syncNovelTextareaHeight();
  });

  afterUpdate(() => {
    syncNovelTextareaHeight();
  });

  $: selectedProvider = aiDraft.selected_provider;
  $: activeSnapshot =
    selectedProvider === 'openrouter' ? aiSettings.openrouter : aiSettings.openai_compatible;
  $: activeDraft =
    selectedProvider === 'openrouter' ? aiDraft.openrouter : aiDraft.openai_compatible;
  $: externalProviderIncomplete =
    selectedProvider !== 'heuristic' &&
    (!activeSnapshot.base_url.trim() || !activeSnapshot.model.trim() || !activeSnapshot.has_api_key);
  $: buildDisabled =
    busy || !projectName.trim() || !novelText.trim() || externalProviderIncomplete;
</script>

<section class="workspace-hero">
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

  <div class="composer">
    <div class="section-head">
      <div>
        <p class="label">新项目</p>
        <h2>导入小说文本</h2>
      </div>
      <button type="button" class="ghost" on:click={() => dispatch('sample')} disabled={busy}>
        载入示例
      </button>
    </div>

    <label>
      <span>项目名称</span>
      <input
        value={projectName}
        on:input={(event) => dispatch('updateProjectName', event.currentTarget.value)}
        placeholder="例如：临川夜话"
        disabled={busy}
      />
    </label>

    <label>
      <span>小说正文</span>
      <textarea
        bind:this={novelTextarea}
        value={novelText}
        on:input={handleNovelTextInput}
        style:overflow-y="hidden"
        placeholder="粘贴 txt 或 markdown 纯文本内容"
        disabled={busy}
      ></textarea>
    </label>

    <section class="provider-panel">
      <div class="provider-head">
        <div>
          <p class="label">AI Provider</p>
          <h3>接口设置</h3>
        </div>
        {#if selectedProvider !== 'heuristic'}
          <span class:ready={activeSnapshot.has_api_key} class="status-pill">
            {activeSnapshot.has_api_key ? '已保存 API key' : '未保存 API key'}
          </span>
        {/if}
      </div>

      <label>
        <span>接口类型</span>
        <select
          value={selectedProvider}
          on:change={(event) => dispatch('updateAiProvider', event.currentTarget.value as AiProviderKind)}
          disabled={busy || settingsBusy}
        >
          {#each Object.entries(providerLabels) as [value, label]}
            <option value={value}>{label}</option>
          {/each}
        </select>
      </label>

      {#if selectedProvider !== 'heuristic'}
        <div class="provider-grid">
          <label>
            <span>Base URL</span>
            <input
              value={activeDraft.base_url}
              on:input={(event) => dispatch('updateAiBaseUrl', event.currentTarget.value)}
              placeholder={selectedProvider === 'openrouter'
                ? 'https://openrouter.ai/api/v1'
                : 'https://api.openai.com/v1'}
              disabled={busy || settingsBusy}
            />
          </label>

          <label>
            <span>模型</span>
            <input
              value={activeDraft.model}
              on:input={(event) => dispatch('updateAiModel', event.currentTarget.value)}
              placeholder={selectedProvider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'}
              disabled={busy || settingsBusy}
            />
          </label>
        </div>

        <label>
          <span>API key</span>
          <input
            type="password"
            value={activeDraft.api_key ?? ''}
            on:input={(event) => dispatch('updateAiApiKey', event.currentTarget.value)}
            placeholder={activeSnapshot.has_api_key ? '输入新 key 可覆盖已保存密钥' : '输入后点击保存接口设置'}
            disabled={busy || settingsBusy}
          />
        </label>

        <div class="provider-actions">
          <button
            type="button"
            class="ghost"
            on:click={() => dispatch('saveAiSettings')}
            disabled={busy || settingsBusy}
          >
            {settingsBusy ? '保存中' : '保存接口设置'}
          </button>

          <button
            type="button"
            class="ghost quiet"
            on:click={() => dispatch('clearProviderApiKey', selectedProvider)}
            disabled={busy || settingsBusy || !activeSnapshot.has_api_key}
          >
            清除已存密钥
          </button>
        </div>

        {#if externalProviderIncomplete}
          <p class="hint">需要填写 base URL、模型和 API key</p>
        {/if}
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
</section>

<style>
  .workspace-hero {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 28px;
    align-items: start;
  }

  .copy,
  .composer {
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

  label {
    display: grid;
    gap: 10px;
  }

  label span {
    font-size: 0.82rem;
    color: rgba(63, 47, 35, 0.82);
  }

  input,
  textarea,
  select {
    width: 100%;
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

  select {
    min-height: 52px;
  }

  textarea {
    min-height: 320px;
    line-height: 1.72;
    overflow-y: hidden;
  }

  .provider-panel {
    display: grid;
    gap: 14px;
    padding: 18px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.56);
    border: 1px solid rgba(121, 103, 81, 0.12);
  }

  .provider-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .provider-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .provider-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(121, 103, 81, 0.08);
    color: #7c6753;
    font-size: 0.82rem;
  }

  .status-pill.ready {
    background: rgba(31, 106, 87, 0.14);
    color: #1f6a57;
  }

  .hint {
    margin: 0;
    color: rgba(92, 73, 55, 0.72);
    font-size: 0.9rem;
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
    .workspace-hero {
      grid-template-columns: 1fr;
    }

    .copy,
    .composer {
      padding: 26px;
    }

    .provider-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
