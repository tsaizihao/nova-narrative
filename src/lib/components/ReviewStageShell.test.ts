import { fireEvent, render, screen } from '@testing-library/svelte';
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
    const { component } = render(ReviewStageShell, {
      props: {
        project,
        lorePreview: [],
        rulePreview,
        error: '',
        busy: false
      }
    });

    const stageShell = screen.getByTestId('review-stage-shell');
    const enterStory = vi.fn();
    stageShell.addEventListener('enterStory', enterStory);

    expect(screen.getByText('临川夜话')).toBeInTheDocument();
    expect(screen.getAllByText('审阅')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Review')[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '先校正世界模型，再进入故事' })).toBeInTheDocument();
    expect(screen.getByTestId('review-stage-strip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入互动故事' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '进入互动故事' }));

    expect(enterStory).toHaveBeenCalledTimes(1);
  });
});
