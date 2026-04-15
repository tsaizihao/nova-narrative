import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReaderDesktopShell from './ReaderDesktopShell.svelte';
import ReaderMobileShell from './ReaderMobileShell.svelte';
import type { RuntimeSnapshot, ScenePayload, SessionState } from '$lib/types';

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
  available_checkpoints: [
    {
      checkpoint: {
        id: 'checkpoint-1',
        label: '城门前',
        scene_id: 'scene-1'
      },
      current_scene_id: 'scene-1',
      visited_scenes: ['scene-1'],
      known_facts: [],
      relationship_deltas: {},
      rule_flags: [],
      major_choices: [],
      story_state: storyState,
      lore_lifecycle: [],
      last_active_rules: []
    }
  ],
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

const snapshot: RuntimeSnapshot = {
  payload,
  codex: {
    characters: [],
    locations: [],
    world_rules: [],
    relationships: [],
    timeline: [],
    recent_choices: [],
    worldbook_entries: [],
    rules: []
  }
};

describe('ReaderDesktopShell', () => {
  it('renders the main stage before the world and state rails', () => {
    const { container } = render(ReaderDesktopShell, {
      props: {
        snapshot,
        freeInput: '',
        busy: false,
        error: ''
      }
    });

    expect(screen.getByRole('heading', { name: '北门之夜' })).toBeInTheDocument();
    expect(screen.getByText('世界侧栏')).toBeInTheDocument();
    expect(screen.getByText('世界状态')).toBeInTheDocument();
    expect(container.querySelector('.reader-desktop')).toHaveAttribute('data-tone', 'paper');
  });

  it('disables checkpoint rewinds in the world rail while the runtime is rewinding', async () => {
    render(ReaderDesktopShell, {
      props: {
        snapshot,
        freeInput: '',
        busy: true,
        busyLabel: '正在回溯到关键节点',
        error: ''
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: '抉择' }));

    expect(screen.getByRole('button', { name: '城门前' })).toBeDisabled();
  });
});

describe('ReaderMobileShell', () => {
  it('keeps lore and state hidden until their drawers are opened', async () => {
    const { container } = render(ReaderMobileShell, {
      props: {
        snapshot,
        freeInput: '',
        busy: false,
        error: ''
      }
    });

    expect(container.querySelector('.reader-mobile')).toHaveAttribute('data-tone', 'paper');
    expect(screen.queryByRole('dialog', { name: '世界侧栏' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '世界状态' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '打开世界信息' }));
    const worldDialog = screen.getByRole('dialog', { name: '世界侧栏' });
    expect(worldDialog).toHaveAttribute('aria-modal', 'true');
    expect(worldDialog).toHaveAttribute('data-tone', 'paper');

    await fireEvent.click(screen.getByRole('button', { name: '打开状态信息' }));
    expect(screen.queryByRole('dialog', { name: '世界侧栏' })).not.toBeInTheDocument();

    const stateDialog = screen.getByRole('dialog', { name: '世界状态' });
    expect(stateDialog).toHaveAttribute('aria-modal', 'true');
    expect(stateDialog).toHaveAttribute('data-tone', 'paper');

    await fireEvent.keyDown(stateDialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '世界状态' })).not.toBeInTheDocument();
  });

  it('surfaces the same rewind lock inside the mobile world drawer', async () => {
    render(ReaderMobileShell, {
      props: {
        snapshot,
        freeInput: '',
        busy: true,
        busyLabel: '正在回溯到关键节点',
        error: ''
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: '打开世界信息' }));
    await fireEvent.click(screen.getByRole('button', { name: '抉择' }));

    expect(screen.getByRole('button', { name: '城门前' })).toBeDisabled();
  });
});
