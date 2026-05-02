import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import AiSettingsPanel from './AiSettingsPanel.svelte';
import type { AppAiSettingsSnapshot, SaveAiSettingsInput } from '$lib/types';

const aiSettings: AppAiSettingsSnapshot = {
  selected_provider: 'openrouter',
  openai_compatible: {
    base_url: '',
    model: '',
    has_api_key: false
  },
  openrouter: {
    base_url: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    has_api_key: true
  }
};

const aiDraft: SaveAiSettingsInput = {
  selected_provider: 'openrouter',
  openai_compatible: {
    base_url: '',
    model: '',
    api_key: ''
  },
  openrouter: {
    base_url: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    api_key: ''
  }
};

describe('AiSettingsPanel', () => {
  it('emits provider and field payloads when the active provider settings change', async () => {
    const updateAiProvider = vi.fn();
    const updateAiBaseUrl = vi.fn();
    const updateAiModel = vi.fn();
    const updateAiApiKey = vi.fn();

    render(AiSettingsPanel, {
      props: {
        aiSettings,
        aiDraft,
        busy: false,
        error: ''
      },
      events: {
        updateAiProvider,
        updateAiBaseUrl,
        updateAiModel,
        updateAiApiKey
      }
    });

    await fireEvent.change(screen.getByLabelText('接口类型'), { target: { value: 'openai_compatible' } });
    await fireEvent.input(screen.getByLabelText('Base URL'), { target: { value: 'https://example.com/v1' } });
    await fireEvent.input(screen.getByLabelText('模型'), { target: { value: 'gpt-4.1-mini' } });
    await fireEvent.input(screen.getByLabelText('API key'), { target: { value: 'sk-test-key' } });

    expect(updateAiProvider).toHaveBeenCalledTimes(1);
    expect(updateAiProvider).toHaveBeenCalledWith(expect.objectContaining({ detail: 'openai_compatible' }));
    expect(updateAiBaseUrl).toHaveBeenCalledTimes(1);
    expect(updateAiBaseUrl).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'https://example.com/v1' })
    );
    expect(updateAiModel).toHaveBeenCalledTimes(1);
    expect(updateAiModel).toHaveBeenCalledWith(expect.objectContaining({ detail: 'gpt-4.1-mini' }));
    expect(updateAiApiKey).toHaveBeenCalledTimes(1);
    expect(updateAiApiKey).toHaveBeenCalledWith(expect.objectContaining({ detail: 'sk-test-key' }));
  });

  it('shows the saved-key state and emits save/clear events', async () => {
    const saveAiSettings = vi.fn();
    const clearProviderApiKey = vi.fn();

    render(AiSettingsPanel, {
      props: {
        aiSettings,
        aiDraft,
        busy: false,
        error: ''
      },
      events: {
        saveAiSettings,
        clearProviderApiKey
      }
    });

    expect(screen.getByText('已保存 API key')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '保存接口设置' }));
    await fireEvent.click(screen.getByRole('button', { name: '清除已存密钥' }));

    expect(saveAiSettings).toHaveBeenCalledTimes(1);
    expect(clearProviderApiKey).toHaveBeenCalledTimes(1);
    expect(clearProviderApiKey).toHaveBeenCalledWith(expect.objectContaining({ detail: 'openrouter' }));
  });

  it('switches to heuristic mode without rendering external-provider fields', async () => {
    const updateAiProvider = vi.fn();

    render(AiSettingsPanel, {
      props: {
        aiSettings: {
          ...aiSettings,
          selected_provider: 'heuristic'
        },
        aiDraft: {
          ...aiDraft,
          selected_provider: 'heuristic'
        },
        busy: false,
        error: ''
      },
      events: {
        updateAiProvider
      }
    });

    expect(screen.queryByLabelText('Base URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('模型')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
  });

  it('disables the select, visible inputs, and action buttons while busy', () => {
    render(AiSettingsPanel, {
      props: {
        aiSettings,
        aiDraft,
        busy: true,
        error: ''
      }
    });

    expect(screen.getByLabelText('接口类型')).toBeDisabled();
    expect(screen.getByLabelText('Base URL')).toBeDisabled();
    expect(screen.getByLabelText('模型')).toBeDisabled();
    expect(screen.getByLabelText('API key')).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存接口设置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '清除已存密钥' })).toBeDisabled();
  });

  it('disables the clear button when the active provider has no saved key', () => {
    render(AiSettingsPanel, {
      props: {
        aiSettings: {
          ...aiSettings,
          selected_provider: 'openai_compatible',
          openai_compatible: {
            base_url: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            has_api_key: false
          }
        },
        aiDraft: {
          ...aiDraft,
          selected_provider: 'openai_compatible',
          openai_compatible: {
            base_url: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            api_key: ''
          }
        },
        busy: false,
        error: ''
      }
    });

    expect(screen.getByRole('button', { name: '清除已存密钥' })).toBeDisabled();
  });
});
