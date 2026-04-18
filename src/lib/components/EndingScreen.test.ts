import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import EndingScreen from './EndingScreen.svelte';
import type { EndingReport, SessionState } from '$lib/types';

const ending: EndingReport = {
  ending_type: '守约结局',
  summary: '你选择让秩序延续，换来一个带着遗憾但可承受的夜晚。',
  decisive_turns: ['守住规则'],
  unresolved_threads: ['门后的真相仍未完全揭开']
};

const session: SessionState = {
  session_id: 'session-1',
  project_id: 'project-1',
  current_scene_id: 'scene-3',
  visited_scenes: ['scene-1', 'scene-3'],
  known_facts: [],
  relationship_deltas: {},
  rule_flags: [],
  major_choices: [],
  available_checkpoints: [
    {
      checkpoint: {
        id: 'cp-1',
        label: '第1章 雨夜来客',
        scene_id: 'scene-1'
      },
      current_scene_id: 'scene-1',
      visited_scenes: ['scene-1'],
      known_facts: [],
      relationship_deltas: {},
      rule_flags: [],
      major_choices: [],
      story_state: {
        current_scene_id: 'scene-1',
        character_states: [],
        fact_records: [],
        relationship_states: {},
        event_flags: [],
        possibility_flags: [],
        unlocked_rules: [],
        visited_scenes: ['scene-1'],
        checkpoints: []
      },
      lore_lifecycle: [],
      last_active_rules: []
    }
  ],
  free_input_history: [],
  story_state: {
    current_scene_id: 'scene-3',
    character_states: [],
    fact_records: [],
    relationship_states: {},
    event_flags: [],
    possibility_flags: [],
    unlocked_rules: [],
    visited_scenes: ['scene-1', 'scene-3'],
    checkpoints: []
  },
  lore_lifecycle: [],
  last_active_rules: [],
  ending_report: ending
};

describe('EndingScreen', () => {
  it('uses the same paper tone as the reader shell and still allows rewinding', async () => {
    const { container } = render(EndingScreen, {
      props: {
        ending,
        session
      }
    });

    expect(screen.getByRole('heading', { name: '守约结局' })).toBeInTheDocument();
    expect(screen.getByText('Ending')).toBeInTheDocument();
    expect(container.querySelector('.ending-shell')).toHaveAttribute('data-tone', 'paper');

    await fireEvent.click(screen.getByRole('button', { name: '第1章 雨夜来客' }));
  });

  it('surfaces rewind guidance and disables checkpoint buttons while rewinding', () => {
    render(EndingScreen, {
      props: {
        ending,
        session,
        busy: true,
        busyLabel: '正在回溯到关键节点'
      }
    });

    expect(screen.getByText('你可以带着刚刚得到的结局理解，回到任一关键节点重写命运。')).toBeInTheDocument();
    expect(screen.getByText('正在回溯到关键节点')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第1章 雨夜来客' })).toBeDisabled();
  });
});
