import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NovelProject, RuleEvaluationResult, StoryState } from '$lib/types';

const reviewBackend = vi.hoisted(() => ({
  updateCharacterCard: vi.fn(),
  upsertWorldBookEntry: vi.fn(),
  deleteWorldBookEntry: vi.fn(),
  upsertRule: vi.fn(),
  deleteRule: vi.fn(),
  previewReviewSnapshot: vi.fn(),
  saveReviewPreviewContext: vi.fn()
}));

vi.mock('$lib/modules/review/backend', () => reviewBackend);

import ReviewStageShell from './ReviewStageShell.svelte';

const storyState: StoryState = {
  current_scene_id: 'scene-1',
  character_states: [],
  fact_records: [],
  relationship_states: {},
  event_flags: [],
  possibility_flags: [],
  unlocked_rules: [],
  visited_scenes: [],
  checkpoints: []
};

const project: NovelProject = {
  id: 'project-1',
  name: '临川夜话',
  raw_text: '原文',
  chapters: [],
  build_status: { stage: 'ready', message: 'done', progress: 100 },
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
  character_cards: [
    {
      id: 'char-1',
      name: '沈砚',
      gender: '男',
      age: 27,
      identity: '巡夜人',
      faction: '巡城司',
      role: '主角',
      summary: '在雨夜追查失踪案。',
      desire: '找回妹妹',
      secrets: ['曾与嫌疑人合作'],
      traits: ['冷静'],
      abilities: ['追踪'],
      mutable_state: {}
    }
  ],
  worldbook_entries: [],
  rules: []
};

describe('ReviewStageShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewBackend.updateCharacterCard.mockResolvedValue(project.character_cards);
    reviewBackend.previewReviewSnapshot.mockResolvedValue({
      context: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: null,
        targetCharacterId: null
      },
      lorePreview: [],
      rulePreview: {
        story_state: storyState,
        active_rules: [],
        blocked: false
      },
      projectedOutcome: {
        blocked: false,
        staysOnScene: true,
        nextSceneId: null,
        nextSceneTitle: null,
        nextSceneSummary: null,
        candidateChoices: []
      },
      explanations: {
        loreSummary: '没有新增 lore 命中',
        ruleSummary: '没有规则阻止当前动作',
        outcomeSummary: '当前上下文下不会推进到新场景'
      }
    });
    reviewBackend.saveReviewPreviewContext.mockResolvedValue({
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: null,
      targetCharacterId: null
    });
  });

  it('renders a compact review strip and dispatches the reader CTA', async () => {
    const enterStory = vi.fn();
    render(ReviewStageShell, {
      props: {
        project,
        busy: false
      },
      events: {
        enterStory
      }
    });

    expect(screen.getByText('临川夜话')).toBeInTheDocument();
    const strip = screen.getByTestId('review-stage-strip');
    expect(within(strip).getByText('Review')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '先校正世界模型，再进入故事' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入互动故事' })).toBeInTheDocument();
    expect(await screen.findByText('预览已就绪')).toBeInTheDocument();

    const stepper = screen.getByRole('list');
    const stepItems = within(stepper).getAllByRole('listitem');
    const currentSteps = stepItems.filter((item) => item.dataset.state === 'current');
    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0]).toHaveTextContent('审阅');

    await fireEvent.click(screen.getByRole('button', { name: '进入互动故事' }));

    expect(enterStory).toHaveBeenCalledTimes(1);
  });

  it('switches the reader CTA copy when an active session can be resumed', () => {
    render(ReviewStageShell, {
      props: {
        project,
        busy: false,
        hasActiveSession: true
      }
    });

    expect(screen.getByRole('button', { name: '继续互动故事' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '进入互动故事' })).not.toBeInTheDocument();
  });

  it('saves edits without using legacy split preview commands and can manually rerun aggregated preview', async () => {
    render(ReviewStageShell, {
      props: {
        project,
        busy: false
      }
    });

    await screen.findByText('预览已就绪');
    reviewBackend.previewReviewSnapshot.mockClear();
    reviewBackend.saveReviewPreviewContext.mockClear();

    const editorColumn = screen.getByTestId('review-editor-column');
    await fireEvent.click(within(editorColumn).getByRole('button', { name: '保存更改' }));

    expect(reviewBackend.updateCharacterCard).toHaveBeenCalledTimes(1);
    expect(reviewBackend.previewReviewSnapshot).not.toHaveBeenCalled();
    expect(screen.getByText('预览已过期')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '刷新预览' }));

    expect(reviewBackend.previewReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(reviewBackend.saveReviewPreviewContext).toHaveBeenCalledTimes(1);
  });
});
