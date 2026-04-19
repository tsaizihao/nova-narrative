import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReaderDesktopShell from './ReaderDesktopShell.svelte';
import ReaderMobileShell from './ReaderMobileShell.svelte';
import { createReaderHistory } from '$lib/modules/runtime/reader-history';
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
  it('renders drawer triggers and restores focus after closing world drawer', async () => {
    const history = createReaderHistory(snapshot);

    render(ReaderDesktopShell, {
      props: {
        projectName: '示例小说',
        snapshot,
        history: history.blocks,
        activity: [{ id: 'activity-1', label: '系统', detail: '读取场景', tone: 'muted' }],
        freeInput: '',
        busy: false,
        error: '',
        autoplay: false,
        retryAvailable: true
      }
    });

    const desktopHeader = document.querySelector('.reader-head');
    expect(desktopHeader).not.toBeNull();

    expect(screen.getByText('示例小说')).toBeInTheDocument();
    expect(within(desktopHeader as HTMLElement).getByRole('heading', { name: '北门之夜', level: 1 })).toBeInTheDocument();
    expect(within(desktopHeader as HTMLElement).getByText('第 1 章')).toBeInTheDocument();
    expect(document.querySelector('.reader-stage')).toHaveAttribute('data-flow', 'longform');
    expect(document.querySelector('.reader-desktop')).toHaveAttribute('data-shell-layout', 'framed-bottom');
    const readerBody = document.querySelector('.reader-body');
    const dockShell = document.querySelector('.reader-dock-shell');
    expect(readerBody).toHaveAttribute('data-reader-region', 'story-scroll');
    expect(dockShell).toHaveAttribute('data-layout', 'stacked-bottom');
    expect(readerBody?.contains(document.querySelector('.reader-stage'))).toBe(true);
    expect(readerBody?.contains(dockShell as Node)).toBe(false);
    expect(screen.getByRole('button', { name: '返回审阅台' })).toBeInTheDocument();
    const worldTrigger = screen.getByRole('button', { name: '世界设定' });
    expect(worldTrigger).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '状态与日志' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument();

    await fireEvent.click(worldTrigger);

    const worldDialog = screen.getByRole('dialog', { name: '世界设定' });
    expect(worldDialog).toHaveAttribute('data-side', 'left');

    await fireEvent.keyDown(worldDialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '世界设定' })).not.toBeInTheDocument();
    expect(worldTrigger).toHaveFocus();
  });

  it('uses fallback project name when projectName is omitted or empty', () => {
    const history = createReaderHistory(snapshot);

    const { rerender } = render(ReaderDesktopShell, {
      props: {
        snapshot,
        history: history.blocks,
        activity: [],
        freeInput: '',
        busy: false,
        error: '',
        autoplay: false,
        retryAvailable: true
      }
    });

    expect(screen.getByText('互动故事')).toBeInTheDocument();

    rerender({
      projectName: '',
      snapshot,
      history: history.blocks,
      activity: [],
      freeInput: '',
      busy: false,
      error: '',
      autoplay: false,
      retryAvailable: true
    });

    expect(screen.getByText('互动故事')).toBeInTheDocument();
  });
});

describe('ReaderMobileShell', () => {
  it('opens state drawer on the right and keeps autoplay controls available', async () => {
    const history = createReaderHistory(snapshot);

    render(ReaderMobileShell, {
      props: {
        projectName: '示例小说',
        snapshot,
        history: history.blocks,
        activity: [{ id: 'activity-2', label: '旁白', detail: '夜色压城', tone: 'accent' }],
        freeInput: '',
        busy: false,
        error: '',
        autoplay: true,
        retryAvailable: true
      }
    });

    const mobileHeader = document.querySelector('.mobile-head');
    expect(mobileHeader).not.toBeNull();

    expect(screen.getByText('示例小说')).toBeInTheDocument();
    expect(within(mobileHeader as HTMLElement).getByRole('heading', { name: '北门之夜', level: 1 })).toBeInTheDocument();
    expect(document.querySelector('.reader-stage')).toHaveAttribute('data-flow', 'longform');
    expect(document.querySelector('.reader-mobile')).toHaveAttribute('data-shell-layout', 'framed-bottom');
    const readerBody = document.querySelector('.reader-body');
    const dockShell = document.querySelector('.reader-dock-shell');
    expect(readerBody).toHaveAttribute('data-reader-region', 'story-scroll');
    expect(dockShell).toHaveAttribute('data-layout', 'stacked-bottom');
    expect(readerBody?.contains(document.querySelector('.reader-stage'))).toBe(true);
    expect(readerBody?.contains(dockShell as Node)).toBe(false);

    await fireEvent.click(screen.getByRole('button', { name: '状态与日志' }));
    const stateDialog = screen.getByRole('dialog', { name: '状态与日志' });
    expect(stateDialog).toHaveAttribute('data-side', 'right');
    expect(screen.getByRole('button', { name: '自动播放' })).toBeInTheDocument();
  });

  it('uses fallback project name when projectName is omitted or empty', () => {
    const history = createReaderHistory(snapshot);

    const { rerender } = render(ReaderMobileShell, {
      props: {
        snapshot,
        history: history.blocks,
        activity: [],
        freeInput: '',
        busy: false,
        error: '',
        autoplay: false,
        retryAvailable: true
      }
    });

    expect(screen.getByText('互动故事')).toBeInTheDocument();

    rerender({
      projectName: '',
      snapshot,
      history: history.blocks,
      activity: [],
      freeInput: '',
      busy: false,
      error: '',
      autoplay: false,
      retryAvailable: true
    });

    expect(screen.getByText('互动故事')).toBeInTheDocument();
  });
});
