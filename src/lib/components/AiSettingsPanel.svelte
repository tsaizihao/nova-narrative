<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { AiProviderKind, AppAiSettingsSnapshot, SaveAiSettingsInput } from '$lib/types';

  export let aiSettings: AppAiSettingsSnapshot;
  export let aiDraft: SaveAiSettingsInput;
  export let busy = false;
  export let error = '';

  const dispatch = createEventDispatcher<{
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

  $: selectedProvider = aiDraft.selected_provider;
  $: activeSnapshot =
    selectedProvider === 'openrouter' ? aiSettings.openrouter : aiSettings.openai_compatible;
  $: activeDraft =
    selectedProvider === 'openrouter' ? aiDraft.openrouter : aiDraft.openai_compatible;
</script>

<section class="ai-settings-panel">
  <div class="provider-head">
    <div>
      <p class="eyebrow">AI Provider</p>
      <h3>接口设置</h3>
    </div>
    {#if selectedProvider !== 'heuristic'}
      <span class:ready={activeSnapshot.has_api_key} class="status-pill">
        {activeSnapshot.has_api_key ? '已保存 API key' : '未保存 API key'}
      </span>
    {/if}
  </div>

  <label class="field">
    <span>接口类型</span>
    <select
      value={selectedProvider}
      on:change={(event) => dispatch('updateAiProvider', event.currentTarget.value as AiProviderKind)}
      disabled={busy}
    >
      {#each Object.entries(providerLabels) as [value, label]}
        <option value={value}>{label}</option>
      {/each}
    </select>
  </label>

  {#if selectedProvider !== 'heuristic'}
    <div class="field-grid">
      <label class="field">
        <span>Base URL</span>
        <input
          value={activeDraft.base_url}
          on:input={(event) => dispatch('updateAiBaseUrl', event.currentTarget.value)}
          placeholder={selectedProvider === 'openrouter'
            ? 'https://openrouter.ai/api/v1'
            : 'https://api.openai.com/v1'}
          disabled={busy}
        />
      </label>

      <label class="field">
        <span>模型</span>
        <input
          value={activeDraft.model}
          on:input={(event) => dispatch('updateAiModel', event.currentTarget.value)}
          placeholder={selectedProvider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'}
          disabled={busy}
        />
      </label>
    </div>

    <label class="field">
      <span>API key</span>
      <input
        type="password"
        value={activeDraft.api_key ?? ''}
        on:input={(event) => dispatch('updateAiApiKey', event.currentTarget.value)}
        placeholder={activeSnapshot.has_api_key ? '输入新 key 可覆盖已保存密钥' : '输入后点击保存接口设置'}
        disabled={busy}
      />
    </label>
  {/if}

  <div class="actions">
    <button type="button" class="primary" on:click={() => dispatch('saveAiSettings')} disabled={busy}>
      保存接口设置
    </button>

    {#if selectedProvider !== 'heuristic'}
      <button
        type="button"
        class="secondary"
        on:click={() => dispatch('clearProviderApiKey', selectedProvider)}
        disabled={busy || !activeSnapshot.has_api_key}
      >
        清除已存密钥
      </button>
    {/if}
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>

<style>
  .ai-settings-panel {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid #e8ded2;
    border-radius: 18px;
    background: #fffdfc;
  }

  .provider-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .provider-head h3 {
    margin: 0.2rem 0 0;
    color: #2c241d;
    font-size: 1.2rem;
    line-height: 1.3;
  }

  .eyebrow {
    margin: 0;
    color: #867666;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .status-pill {
    align-self: center;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: #f7f2ea;
    color: #867666;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .status-pill.ready {
    background: #e4f0ec;
    color: #1f6a57;
  }

  .field,
  .field-grid {
    display: grid;
    gap: 0.5rem;
  }

  .field span {
    color: #4b4036;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  select,
  input {
    width: 100%;
    min-width: 0;
    padding: 0.8rem 0.95rem;
    border: 1px solid #d8c9b7;
    border-radius: 12px;
    background: #fcf9f4;
    color: #2c241d;
    font: inherit;
    box-sizing: border-box;
  }

  select:disabled,
  input:disabled,
  button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  button {
    padding: 0.7rem 1rem;
    border-radius: 999px;
    border: 1px solid #d8c9b7;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    background: #1f6a57;
    border-color: #1f6a57;
    color: #fffdfc;
  }

  .secondary {
    background: transparent;
    color: #4b4036;
  }

  .error {
    margin: 0;
    color: #b2534a;
    font-size: 0.88rem;
  }

  @media (max-width: 720px) {
    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
