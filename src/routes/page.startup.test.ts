import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NovelProject, ProjectSummary, RuleEvaluationResult, StoryState } from '$lib/types';

const api = {
  createProject: vi.fn(),
  importNovelText: vi.fn(),
  buildStoryPackage: vi.fn(),
  getBuildStatus: vi.fn(),
  loadStoryPackage: vi.fn(),
  listProjects: vi.fn(),
  getRecentProject: vi.fn(),
  getProject: vi.fn(),
  startSession: vi.fn(),
  getCurrentScene: vi.fn(),
  submitChoice: vi.fn(),
  submitFreeInput: vi.fn(),
  getStoryCodex: vi.fn(),
  updateCharacterCard: vi.fn(),
  upsertWorldBookEntry: vi.fn(),
  deleteWorldBookEntry: vi.fn(),
  upsertRule: vi.fn(),
  deleteRule: vi.fn(),
  previewActiveWorldbook: vi.fn(),
  previewRuleEvaluation: vi.fn(),
  rewindToCheckpoint: vi.fn(),
  finishSession: vi.fn()
};

vi.mock('$lib/api/client', () => ({ api }));

const baseStoryState: StoryState = {
  current_scene_id: 'scene-1',
  character_states: [],
  fact_records: [],
  relationship_states: {},
  event_flags: [],
  possibility_flags: [],
  unlocked_rules: [],
  visited_scenes: ['scene-1'],
  checkpoints: [],
  ending_report: null
};

function buildProject(overrides: Partial<NovelProject> = {}): NovelProject {
  return {
    id: 'project-1',
    name: '临川夜话',
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
    last_opened_at: '2026-04-08T00:00:00.000Z',
    raw_text: '第1章 雨夜来客\n\n沈砚站在门前。',
    chapters: [],
    build_status: {
      stage: 'created',
      message: 'Project created',
      progress: 0
    },
    story_package: null,
    character_cards: [],
    worldbook_entries: [],
    rules: [],
    ...overrides
  };
}

function buildSummary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'project-1',
    name: '临川夜话',
    build_status: {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    },
    has_story_package: true,
    last_opened_at: '2026-04-08T00:00:00.000Z',
    ...overrides
  };
}

const emptyRulePreview: RuleEvaluationResult = {
  story_state: baseStoryState,
  active_rules: [],
  blocked: false
};

async function renderPage() {
  const module = await import('./+page.svelte');
  return render(module.default);
}

describe('+page startup restore flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getRecentProject.mockResolvedValue(null);
    api.previewActiveWorldbook.mockResolvedValue([]);
    api.previewRuleEvaluation.mockResolvedValue(emptyRulePreview);
  });

  it('starts on a blank import form and still lets the user load the sample manually', async () => {
    await renderPage();

    const projectNameInput = (await screen.findByLabelText('项目名称')) as HTMLInputElement;
    const novelTextInput = screen.getByLabelText('小说正文') as HTMLTextAreaElement;

    await waitFor(() => expect(api.getRecentProject).toHaveBeenCalledTimes(1));
    expect(projectNameInput.value).toBe('');
    expect(novelTextInput.value).toBe('');
    expect(screen.getByText('叙世者')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '载入示例' }));

    expect(projectNameInput.value).not.toBe('');
    expect(novelTextInput.value).not.toBe('');
  });

  it('restores the review phase when the recent project already has a story package', async () => {
    api.getRecentProject.mockResolvedValue(buildSummary());
    api.getProject.mockResolvedValue(
      buildProject({
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
        }
      })
    );

    await renderPage();

    expect(await screen.findByRole('button', { name: '进入互动故事' })).toBeInTheDocument();
    expect(screen.getByText('先校正世界模型，再进入故事')).toBeInTheDocument();
  });

  it('prefills the import form when the recent project has text but is not built yet', async () => {
    api.getRecentProject.mockResolvedValue(
      buildSummary({
        has_story_package: false,
        build_status: {
          stage: 'imported',
          message: 'Novel imported',
          progress: 20
        }
      })
    );
    api.getProject.mockResolvedValue(
      buildProject({
        build_status: {
          stage: 'imported',
          message: 'Novel imported',
          progress: 20
        }
      })
    );

    await renderPage();

    const projectNameInput = (await screen.findByLabelText('项目名称')) as HTMLInputElement;
    const novelTextInput = screen.getByLabelText('小说正文') as HTMLTextAreaElement;

    await waitFor(() => {
      expect(projectNameInput.value).toBe('临川夜话');
      expect(novelTextInput.value).toContain('沈砚站在门前');
    });
  });
});
