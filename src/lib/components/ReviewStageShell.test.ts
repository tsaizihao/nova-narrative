import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import ReviewStageShell from './ReviewStageShell.svelte';
import type { NovelProject, RuleEvaluationResult, StoryState } from '$lib/types';

const project: NovelProject = {
  id: 'project-1',
  name: '临川夜话',
  raw_text: '原文',
  chapters: [],
  build_status: { stage: 'ready', message: 'done', progress: 100 },
  story_package: null,
  character_cards: [],
  worldbook_entries: [],
  rules: []
};

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

const rulePreview: RuleEvaluationResult = {
  story_state: storyState,
  active_rules: [],
  blocked: false
};

describe('ReviewStageShell', () => {
  it('renders a compact review strip and dispatches the reader CTA', async () => {
    const enterStory = vi.fn();
    render(ReviewStageShell, {
      props: {
        project,
        lorePreview: [],
        rulePreview,
        error: '',
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
    expect(screen.getByTestId('review-stage-strip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入互动故事' })).toBeInTheDocument();

    const stepper = screen.getByRole('list');
    const stepItems = within(stepper).getAllByRole('listitem');
    const currentSteps = stepItems.filter((item) => item.dataset.state === 'current');
    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0]).toHaveTextContent('审阅');

    await fireEvent.click(screen.getByRole('button', { name: '进入互动故事' }));

    expect(enterStory).toHaveBeenCalledTimes(1);
  });
});
