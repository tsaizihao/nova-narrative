import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReaderStage from './ReaderStage.svelte';
import type { ScenePayload } from '$lib/types';

const payload: ScenePayload = {
  scene: {
    id: 'scene-1',
    chapter: 1,
    title: '北门之夜',
    summary: '夜色压城',
    narration: ['第一段'],
    dialogue: [],
    entry_conditions: [],
    present_characters: [],
    candidate_choices: [
      {
        id: 'choice-1',
        label: '前往北门',
        intent_tag: 'inspect',
        state_effects: [],
        unlock_conditions: [],
        next_scene_id: 'scene-2'
      }
    ],
    fallback_next: null,
    allow_free_input: true,
    checkpoint: true,
    ending: null
  },
  session: {
    session_id: 'session-1',
    project_id: 'project-1',
    current_scene_id: 'scene-1',
    visited_scenes: ['scene-1'],
    known_facts: [],
    relationship_deltas: {},
    rule_flags: [],
    major_choices: [],
    available_checkpoints: [],
    free_input_history: [],
    ending_report: null,
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
  },
  active_lore: [],
  active_rules: [],
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
  }
};

describe('ReaderStage', () => {
  it('shows a busy action hint when the runtime is processing a decision', () => {
    const { container } = render(ReaderStage, {
      props: {
        payload,
        freeInput: '我先稳住对方',
        busy: true,
        busyLabel: '正在写入自由行动',
        error: ''
      }
    });

    expect(container.querySelector('.busy-hint')).toHaveTextContent('正在写入自由行动');
    expect(screen.getByRole('button', { name: '前往北门' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '正在写入自由行动' })).toHaveTextContent('正在写入自由行动');
  });
});
