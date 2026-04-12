import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ImportScreen from './ImportScreen.svelte';
import type { AppAiSettingsSnapshot, SaveAiSettingsInput } from '$lib/types';

describe('ImportScreen', () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight');
  let mockScrollHeight = 420;
  const aiSettings: AppAiSettingsSnapshot = {
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
  const aiDraft: SaveAiSettingsInput = {
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

  beforeEach(() => {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return mockScrollHeight;
      }
    });
  });

  afterEach(() => {
    if (originalScrollHeight) {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
  });

  it('auto-resizes the novel textarea so the page keeps a single scroll container', async () => {
    const { rerender } = render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第一章\n'.repeat(20),
        busy: false,
        error: '',
        aiSettings,
        aiDraft,
        settingsBusy: false
      }
    });

    await tick();

    const textarea = screen.getByRole('textbox', { name: '小说正文' }) as HTMLTextAreaElement;
    expect(textarea.style.height).toBe('420px');
    expect(getComputedStyle(textarea).overflowY).toBe('hidden');

    mockScrollHeight = 220;
    await rerender({
      projectName: '临川夜话',
      novelText: '短文本',
      busy: false,
      error: '',
      aiSettings,
      aiDraft,
      settingsBusy: false
    });
    await tick();

    expect(textarea.style.height).toBe('320px');
  });

  it('disables build for incomplete external provider settings and keeps heuristic one-click ready', async () => {
    const { rerender } = render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings,
        aiDraft: {
          ...aiDraft,
          selected_provider: 'openai_compatible',
          openai_compatible: {
            base_url: 'https://example.com/v1',
            model: '',
            api_key: ''
          }
        },
        settingsBusy: false
      }
    });

    expect(screen.getByRole('button', { name: '开始解析与改编' })).toBeDisabled();
    expect(screen.getByText('需要填写 base URL、模型和 API key')).toBeInTheDocument();

    await rerender({
      projectName: '临川夜话',
      novelText: '第1章 雨夜来客',
      busy: false,
      error: '',
      aiSettings,
      aiDraft,
      settingsBusy: false
    });

    expect(screen.getByRole('button', { name: '开始解析与改编' })).toBeEnabled();
  });

  it('renders a support rail so the desktop import view is not left with an empty column', () => {
    render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings,
        aiDraft,
        settingsBusy: false
      }
    });

    expect(screen.getByText('导入提示')).toBeInTheDocument();
    expect(screen.getAllByText('优先粘贴完整章节正文')).toHaveLength(2);
    expect(screen.getByText('这一步会产出')).toBeInTheDocument();
  });
});
