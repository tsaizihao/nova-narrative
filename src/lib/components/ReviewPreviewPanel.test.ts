import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReviewPreviewPanel from './ReviewPreviewPanel.svelte';
import type { RuleEvaluationResult, StoryState } from '$lib/types';

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

describe('ReviewPreviewPanel', () => {
  it('shows state summary inside the rules preview group', () => {
    render(ReviewPreviewPanel, { props: { lorePreview: [], rulePreview, error: '' } });

    const rulesSection = screen.getByTestId('review-rules-preview');
    expect(within(rulesSection).getByText('规则预览')).toBeInTheDocument();
    expect(within(rulesSection).getByText('预测状态')).toBeInTheDocument();
    expect(
      within(rulesSection).getByText(/^(conception=true|possibility\.conception=true|怀孕)$/)
    ).toBeInTheDocument();
  });
});
