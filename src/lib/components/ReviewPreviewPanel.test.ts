import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import ReviewPreviewPanel from './ReviewPreviewPanel.svelte';
import type {
  ReviewPreviewContext,
  ReviewPreviewSnapshot,
  RuleEvaluationResult,
  StoryState
} from '$lib/types';

const storyState: StoryState = {
  current_scene_id: 'scene-1',
  character_states: [],
  fact_records: [],
  relationship_states: {},
  event_flags: [],
  possibility_flags: ['possibility.conception=true'],
  unlocked_rules: [],
  visited_scenes: [],
  checkpoints: []
};

const rulePreview: RuleEvaluationResult = {
  story_state: storyState,
  active_rules: [
    {
      rule_id: 'r1',
      name: '怀孕可能性',
      priority: 'consequence',
      explanation: '写入 possibility.conception=true',
      effects: [],
      reason: '命中状态规则'
    }
  ],
  blocked: false
};

const draftContext: ReviewPreviewContext = {
  sceneId: 'scene-1',
  eventKind: 'open_gate',
  inputText: '午夜去开门',
  actorCharacterId: 'char-1',
  targetCharacterId: 'char-2'
};

const snapshot: ReviewPreviewSnapshot = {
  context: draftContext,
  lorePreview: [
    {
      entry_id: 'w1',
      title: '北门禁令',
      slot: 'rules_guard',
      matched_keys: ['北门'],
      reason: '命中北门',
      lifecycle_state: 'ready',
      content: '午夜不可开门',
      source: 'extractor',
      rule_binding: null
    }
  ],
  rulePreview: { ...rulePreview, blocked: true },
  projectedOutcome: {
    blocked: true,
    staysOnScene: true,
    nextSceneId: null,
    nextSceneTitle: null,
    nextSceneSummary: null,
    candidateChoices: []
  },
  explanations: {
    loreSummary: '命中 1 条 lore',
    ruleSummary: '存在阻塞规则',
    outcomeSummary: '动作会停留在当前场景'
  }
};

describe('ReviewPreviewPanel', () => {
  it('renders preview context controls, explanations and projected outcome', async () => {
    const refresh = vi.fn();
    const updateContext = vi.fn();
    render(ReviewPreviewPanel, {
      props: {
        draftContext,
        appliedContext: draftContext,
        sceneOptions: [{ id: 'scene-1', title: '北门之夜' }],
        characterOptions: [
          { id: 'char-1', name: '沈砚' },
          { id: 'char-2', name: '宁昭' }
        ],
        previewSnapshot: snapshot,
        refreshError: '',
        status: 'ready'
      },
      events: {
        refresh,
        updateContext
      }
    });

    expect(screen.getByLabelText('预览场景')).toBeInTheDocument();
    expect(screen.getByLabelText('事件类型')).toHaveValue('open_gate');
    expect(screen.getByLabelText('输入文本')).toHaveValue('午夜去开门');
    expect(screen.getByText('命中 1 条 lore')).toBeInTheDocument();
    expect(screen.getByText('动作会停留在当前场景')).toBeInTheDocument();
    expect(screen.getByText('存在阻塞规则')).toBeInTheDocument();
    expect(screen.getByText('停留在当前场景')).toBeInTheDocument();

    const rulesSection = screen.getByTestId('review-rules-preview');
    expect(within(rulesSection).getByText('规则预览')).toBeInTheDocument();
    expect(within(rulesSection).getByText('规则说明')).toBeInTheDocument();
    expect(
      within(rulesSection).getByText(/^(conception=true|possibility\.conception=true|怀孕)$/)
    ).toBeInTheDocument();

    await fireEvent.change(screen.getByLabelText('事件类型'), {
      target: { value: 'seek_truth' }
    });
    expect(updateContext).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole('button', { name: '刷新预览' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
