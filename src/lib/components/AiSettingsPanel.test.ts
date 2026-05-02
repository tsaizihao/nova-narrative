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
});
