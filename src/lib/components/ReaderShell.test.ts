import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReaderDesktopShell from './ReaderDesktopShell.svelte';
import type { ScenePayload, SessionState } from '$lib/types';

const storyState = {
  current_scene_id: 'scene-1',
  character_states: [],
  fact_records: [],
  relationship_states: {},
  event_flags: ['night'],
  possibility_flags: [],
  unlocked_rules: [],
  visited_scenes: [],
  checkpoints: []
};

const session: SessionState = {
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
  story_state: storyState,
  lore_lifecycle: [],
  last_active_rules: []
};

const payload: ScenePayload = {
  scene: {
    id: 'scene-1',
    chapter: 1,
    title: '北门之夜',
    summary: '夜色压城',
    narration: ['第一段', '第二段'],
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
    checkpoint: true
  },
  session,
  active_lore: [
    {
      entry_id: 'w1',
      title: '北门禁令',
      slot: 'rules_guard',
      matched_keys: ['北门'],
      reason: '命中北门',
      lifecycle_state: 'ready',
      content: '午夜不能开门',
      source: 'extractor',
      rule_binding: null
    }
  ],
  active_rules: [
    {
      rule_id: 'r1',
      name: '午夜禁令',
      priority: 'hard_constraint',
      explanation: '午夜不能开北门',
      effects: [],
      reason: '命中午夜'
    }
  ],
  story_state: storyState
};

describe('ReaderDesktopShell', () => {
  it('renders the main stage before the world and state rails', () => {
    render(ReaderDesktopShell, {
      props: {
        payload,
        codex: null,
        session,
        freeInput: '',
        busy: false,
        error: ''
      }
    });

    expect(screen.getByRole('heading', { name: '北门之夜' })).toBeInTheDocument();
    expect(screen.getByText('世界侧栏')).toBeInTheDocument();
    expect(screen.getByText('世界状态')).toBeInTheDocument();
  });
});
