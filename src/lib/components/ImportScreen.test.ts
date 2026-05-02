import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImportScreen from './ImportScreen.svelte';
import type { AppAiSettingsSnapshot, NovelProject } from '$lib/types';

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
  const resumableProjects: Array<{
    project: NovelProject;
    sessionId: string | null;
    activityLabel: string;
    activityTimeLabel: string;
    ctaLabel: string;
  }> = [
    {
      project: {
        id: 'project-1',
        name: '临川夜话',
        raw_text: '第1章 雨夜来客',
        chapters: [],
        build_status: {
          stage: 'ready',
          message: 'Story package ready',
          progress: 100
        },
        story_package: {
          story_bible: {
            title: '临川夜话',
            characters: [],
            locations: [],
            timeline: [],
            world_rules: [],
            relationships: [],
            core_conflicts: []
          },
          world_model: {
            character_cards: [],
            worldbook_entries: [],
            rules: []
          },
          start_scene_id: 'scene-1',
          scenes: {}
        },
        character_cards: [],
        worldbook_entries: [],
        rules: []
      },
      sessionId: 'session-1',
      activityLabel: '上次停在：北门之夜',
      activityTimeLabel: '15 分钟前',
      ctaLabel: '继续互动临川夜话'
    },
    {
      project: {
        id: 'project-3',
        name: '归潮纪',
        raw_text: '第1章 雨夜来客',
        chapters: [],
        build_status: {
          stage: 'ready',
          message: 'Story package ready',
          progress: 100
        },
        story_package: {
          story_bible: {
            title: '归潮纪',
            characters: [],
            locations: [],
            timeline: [],
            world_rules: [],
            relationships: [],
            core_conflicts: []
          },
          world_model: {
            character_cards: [],
            worldbook_entries: [],
            rules: []
          },
          start_scene_id: 'scene-1',
          scenes: {}
        },
        character_cards: [],
        worldbook_entries: [],
        rules: []
      },
      sessionId: 'session-ending',
      activityLabel: '已抵达结局：灰烬归档',
      activityTimeLabel: '昨天',
      ctaLabel: '查看结局归潮纪'
    },
    {
      project: {
        id: 'project-2',
        name: '霜桥夜行',
        raw_text: '第1章 雨夜来客',
        chapters: [],
        build_status: {
          stage: 'ready',
          message: 'Story package ready',
          progress: 100
        },
        story_package: {
          story_bible: {
            title: '霜桥夜行',
            characters: [],
            locations: [],
            timeline: [],
            world_rules: [],
            relationships: [],
            core_conflicts: []
          },
          world_model: {
            character_cards: [],
            worldbook_entries: [],
            rules: []
          },
          start_scene_id: 'scene-1',
          scenes: {}
        },
        character_cards: [],
        worldbook_entries: [],
        rules: []
      },
      sessionId: null,
      activityLabel: '尚未开始互动，可先进入审阅',
      activityTimeLabel: '2026-04-01',
      ctaLabel: '进入审阅霜桥夜行'
    }
  ];

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
        resumableProjects: []
      }
    });

    await tick();

    const textarea = screen.getByRole('textbox', { name: '小说正文' }) as HTMLTextAreaElement;
    const projectNameInput = screen.getByRole('textbox', { name: '项目名称' }) as HTMLInputElement;
    expect(projectNameInput.style.boxSizing).toBe('border-box');
    expect(projectNameInput.style.maxWidth).toBe('100%');
    expect(textarea.style.boxSizing).toBe('border-box');
    expect(textarea.style.maxWidth).toBe('100%');
    expect(textarea.style.height).toBe('420px');
    expect(getComputedStyle(textarea).overflowY).toBe('hidden');

    mockScrollHeight = 220;
    await rerender({
      projectName: '临川夜话',
      novelText: '短文本',
      busy: false,
      error: '',
      aiSettings,
      resumableProjects: []
    });
    await tick();

    expect(textarea.style.height).toBe('320px');
  });

  it('shows an AI settings summary card instead of the full provider form', () => {
    render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings: {
          ...aiSettings,
          selected_provider: 'openrouter',
          openrouter: {
            base_url: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-4o-mini',
            has_api_key: true
          }
        },
        resumableProjects: [],
        settingsPrompt: '去设置页补全和管理你的模型配置。'
      }
    });

    expect(screen.getByText('AI 设置')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('配置已就绪')).toBeInTheDocument();
    expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
    expect(screen.getByText('已保存')).toBeInTheDocument();
    expect(screen.getByText('去设置页补全和管理你的模型配置。')).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Base URL')).not.toBeInTheDocument();
  });

  it('shows incomplete external config summary text and keeps the build button enabled when text is present', () => {
    render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings: {
          ...aiSettings,
          selected_provider: 'openai_compatible',
          openai_compatible: {
            base_url: 'https://example.com/v1',
            model: '',
            has_api_key: false
          }
        },
        resumableProjects: []
      }
    });

    expect(screen.getByText('配置未完成')).toBeInTheDocument();
    expect(screen.getByText('未保存')).toBeInTheDocument();
    expect(screen.getByText('未设置模型')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始解析与改编' })).toBeEnabled();
  });

  it('shows heuristic-specific summary text without leaking stale external model data', () => {
    render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings: {
          selected_provider: 'heuristic',
          openai_compatible: {
            base_url: 'https://example.com/v1',
            model: 'stale-external-model',
            has_api_key: true
          },
          openrouter: {
            base_url: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-4o-mini',
            has_api_key: true
          }
        },
        resumableProjects: []
      }
    });

    expect(screen.getByText('启发式（离线）')).toBeInTheDocument();
    expect(screen.getByText('离线模式，无需额外配置')).toBeInTheDocument();
    expect(screen.getByText('离线启发式')).toBeInTheDocument();
    expect(screen.getByText('不需要')).toBeInTheDocument();
    expect(screen.queryByText('stale-external-model')).not.toBeInTheDocument();
  });

  it('emits openSettings when the summary-card action is clicked', async () => {
    const openSettings = vi.fn();

    render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings: {
          ...aiSettings,
          selected_provider: 'openrouter',
          openrouter: {
            base_url: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-4o-mini',
            has_api_key: true
          }
        },
        resumableProjects: []
      },
      events: {
        openSettings
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: '去配置' }));

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('renders a support rail so the desktop import view is not left with an empty column', () => {
    render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第1章 雨夜来客',
        busy: false,
        error: '',
        aiSettings,
        resumableProjects: []
      }
    });

    expect(screen.getByText('导入提示')).toBeInTheDocument();
    expect(screen.getAllByText('优先粘贴完整章节正文')).toHaveLength(2);
    expect(screen.getByText('这一步会产出')).toBeInTheDocument();
  });

  it('surfaces saved projects in a separate shelf so the hero columns stay balanced', () => {
    const { container } = render(ImportScreen, {
      props: {
        projectName: '',
        novelText: '',
        busy: false,
        error: '',
        aiSettings,
        resumableProjects
      }
    });

    const supportRail = container.querySelector('.support-rail');
    const workspaceHero = container.querySelector('.workspace-hero');
    const resumeShelf = screen.getByText('继续已有项目').closest('section');

    expect(resumeShelf).toBeTruthy();
    expect(supportRail?.contains(resumeShelf as HTMLElement)).toBe(false);
    expect(workspaceHero?.contains(resumeShelf as HTMLElement)).toBe(false);

    expect(screen.getByText('继续已有项目')).toBeInTheDocument();
    expect(screen.getByText('临川夜话')).toBeInTheDocument();
    expect(screen.getByText('上次停在：北门之夜')).toBeInTheDocument();
    expect(screen.getByText('15 分钟前')).toBeInTheDocument();
    expect(screen.getByText('已抵达结局：灰烬归档')).toBeInTheDocument();
    expect(screen.getByText('昨天')).toBeInTheDocument();
    expect(screen.getByText('尚未开始互动，可先进入审阅')).toBeInTheDocument();
    expect(screen.getByText('2026-04-01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续互动临川夜话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看结局归潮纪' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入审阅霜桥夜行' })).toBeInTheDocument();
  });

  it('accepts txt file import and emits the filled project name and text', async () => {
    const updates: string[] = [];
    const loaded = vi.fn();

    render(ImportScreen, {
      props: {
        projectName: '',
        novelText: '',
        busy: false,
        error: '',
        aiSettings,
        resumableProjects: []
      },
      events: {
        updateProjectName: (event) => updates.push(`name:${event.detail}`),
        updateNovelText: (event) => updates.push(`text:${event.detail}`),
        fileLoaded: loaded
      }
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['第1章 雨夜来客\n\n沈砚站在门前。'], '临川夜话.txt', {
      type: 'text/plain'
    });

    await fireEvent.change(fileInput, {
      target: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(updates).toContain('name:临川夜话');
      expect(updates).toContain('text:第1章 雨夜来客\n\n沈砚站在门前。');
      expect(loaded).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces txt file import errors through the component event channel', async () => {
    const fileError = vi.fn();

    render(ImportScreen, {
      props: {
        projectName: '',
        novelText: '',
        busy: false,
        error: '',
        aiSettings,
        resumableProjects: []
      },
      events: {
        fileError
      }
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['# not txt'], 'story.md', { type: 'text/markdown' });

    await fireEvent.change(fileInput, {
      target: {
        files: [file]
      }
    });

    expect(fileError).toHaveBeenCalledTimes(1);
    expect(fileError.mock.calls[0]?.[0]?.detail).toBe('目前只支持导入 .txt 纯文本文件');
  });
});
