import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const snapshot = {
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

const mocks = vi.hoisted(() => ({
  settingsBackend: {
    getAiSettings: vi.fn(),
    saveAiSettings: vi.fn(),
    clearProviderApiKey: vi.fn()
  },
  navigation: {
    goto: vi.fn()
  }
}));

vi.mock('$lib/modules/settings/backend', () => mocks.settingsBackend);
vi.mock('$app/navigation', () => mocks.navigation);

import SettingsPage from './+page.svelte';

describe('/settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.settingsBackend.getAiSettings.mockResolvedValue(snapshot);
    mocks.settingsBackend.saveAiSettings.mockResolvedValue(snapshot);
    mocks.settingsBackend.clearProviderApiKey.mockResolvedValue(snapshot);
  });

  it('loads the AI settings panel and marks settings as active in the topbar', async () => {
    render(SettingsPage);

    expect(
      await screen.findByRole('heading', {
        name: 'AI 设置'
      })
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-pressed', 'true');

    expect(await screen.findByText('已保存 API key')).toBeInTheDocument();
  });

  it('saves settings through the shared backend', async () => {
    render(SettingsPage);

    await screen.findByText('已保存 API key');

    await fireEvent.click(screen.getByRole('button', { name: '保存接口设置' }));

    await waitFor(() => {
      expect(mocks.settingsBackend.saveAiSettings).toHaveBeenCalledWith({
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
      });
    });
  });

  it('returns to the workspace when the back action is clicked', async () => {
    render(SettingsPage);

    await screen.findByText('已保存 API key');

    await fireEvent.click(screen.getByRole('button', { name: '返回当前工作' }));

    expect(mocks.navigation.goto).toHaveBeenCalledWith('/');
  });
});
