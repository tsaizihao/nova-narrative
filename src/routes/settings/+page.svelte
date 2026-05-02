<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  import AiSettingsPanel from '$lib/components/AiSettingsPanel.svelte';
  import WorkspaceTopbar from '$lib/components/WorkspaceTopbar.svelte';
  import * as settingsBackend from '$lib/modules/settings/backend';
  import type { AiProviderKind, AppAiSettingsSnapshot, SaveAiSettingsInput } from '$lib/types';

  let error = '';
  let busy = false;
  let hasLoaded = false;
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

  async function loadAiSettings() {
    busy = true;
    error = '';

    try {
      aiSettings = await settingsBackend.getAiSettings();
      syncAiDraft(aiSettings);
      hasLoaded = true;
    } catch (caught) {
      hasLoaded = false;
      throw caught;
    } finally {
      busy = false;
    }
  }

  async function persistAiSettings() {
    if (!hasLoaded) return;

    busy = true;
    error = '';

    try {
      aiSettings = await settingsBackend.saveAiSettings(aiDraft);
      syncAiDraft(aiSettings);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '保存 AI 接口设置失败';
    } finally {
      busy = false;
    }
  }

  async function clearProviderApiKey(provider: AiProviderKind) {
    if (!hasLoaded || provider === 'heuristic') return;

    busy = true;
    error = '';

    try {
      aiSettings = await settingsBackend.clearProviderApiKey(provider);
      syncAiDraft(aiSettings);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '清除 API key 失败';
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void loadAiSettings().catch((caught) => {
      error = caught instanceof Error ? caught.message : '加载 AI 设置失败';
    });
  });
</script>

<svelte:head>
  <title>AI 设置</title>
</svelte:head>

<div class="settings-route">
  <WorkspaceTopbar
    eyebrow="叙世者"
    title="AI 设置"
    metaLabel="全局模型连接配置"
    phase="import"
    labels={['导入', '构建', '审阅', '游玩']}
    showStepper={false}
    showSettingsAction={true}
    settingsActive={true}
  />

  <main class="settings-shell">
    <section class="intro-panel">
      <div class="intro-copy">
        <p class="eyebrow">Global Provider Setup</p>
        <h1>AI 设置</h1>
        <p>
          在这里维护全局模型接口连接。保存后的配置会被导入、构建和后续工作流复用。
        </p>
      </div>

      <button type="button" class="back-action" on:click={() => goto('/')}>
        返回当前工作
      </button>
    </section>

    <AiSettingsPanel
      {aiSettings}
      {aiDraft}
      busy={busy || !hasLoaded}
      {error}
      on:updateAiProvider={(event) => updateAiProvider(event.detail)}
      on:updateAiBaseUrl={(event) => updateActiveAiField('base_url', event.detail)}
      on:updateAiModel={(event) => updateActiveAiField('model', event.detail)}
      on:updateAiApiKey={(event) => updateActiveAiField('api_key', event.detail)}
      on:saveAiSettings={persistAiSettings}
      on:clearProviderApiKey={(event) => clearProviderApiKey(event.detail)}
    />
  </main>
</div>

<style>
  :global(body) {
    background: #f5f1ea;
  }

  .settings-route {
    min-height: 100vh;
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(228, 240, 236, 0.78), transparent 30%),
      linear-gradient(180deg, #f7f2ea 0%, #f5f1ea 100%);
  }

  .settings-shell {
    display: grid;
    gap: 24px;
    max-width: 1080px;
    margin: 24px auto 0;
  }

  .intro-panel {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 32px;
    border: 1px solid #e8ded2;
    border-radius: 18px;
    background: #fffdfc;
    box-shadow: 0 18px 38px rgba(70, 54, 39, 0.08);
  }

  .intro-copy {
    display: grid;
    gap: 10px;
    max-width: 640px;
  }

  .eyebrow {
    margin: 0;
    color: #867666;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: #2c241d;
    font-family: 'Iowan Old Style', 'Songti SC', serif;
    font-size: clamp(2rem, 3vw, 2.4rem);
    line-height: 1.1;
  }

  .intro-copy p:last-child {
    margin: 0;
    color: #4b4036;
    font-size: 1rem;
    line-height: 1.7;
  }

  .back-action {
    flex: none;
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid #d8c9b7;
    border-radius: 14px;
    background: #fcf9f4;
    color: #2c241d;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 160ms ease,
      background-color 160ms ease,
      transform 160ms ease;
  }

  .back-action:hover {
    border-color: #bba58c;
    background: #f7f2ea;
    transform: translateY(-1px);
  }

  .back-action:focus-visible {
    outline: none;
    border-color: #1f6a57;
    box-shadow: 0 0 0 3px rgba(31, 106, 87, 0.14);
  }

  @media (max-width: 720px) {
    .settings-route {
      padding: 16px;
    }

    .settings-shell {
      margin-top: 16px;
    }

    .intro-panel {
      display: grid;
      padding: 24px;
    }

    .back-action {
      width: 100%;
      justify-self: stretch;
    }
  }
</style>
