import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReviewWorkspace from './ReviewWorkspace.svelte';
import type { NovelProject, RuleEvaluationResult, StoryState } from '$lib/types';

const project: NovelProject = {
  id: 'project-1',
  name: '北门夜话',
  raw_text: '原文',
  chapters: [],
  build_status: {
    stage: 'ready',
    message: 'done',
    progress: 100
  },
  story_package: null,
  character_cards: [
    {
      id: 'c1',
      name: '阿遥',
      gender: '女',
      age: null,
      identity: '医生',
      faction: '城中',
      role: '主角',
      summary: '冷静克制',
      desire: '查清真相',
      secrets: [],
      traits: [],
      abilities: [],
      mutable_state: {}
    }
  ],
  worldbook_entries: [
    {
      id: 'w1',
      title: '北门',
      category: 'location',
      content: '午夜不可开门',
      enabled: true,
      keys: ['北门'],
      secondary_keys: [],
      selective_logic: 'and_any',
      constant: false,
      recursive: false,
      exclude_recursion: false,
      prevent_recursion: false,
      delay_until_recursion: null,
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: false,
      sticky: null,
      cooldown: null,
      delay: null,
      triggers: [],
      ignore_budget: false,
      order: 1,
      insertion_mode: 'rules_guard',
      source: 'extractor',
      rule_binding: null
    }
  ],
  rules: [
    {
      id: 'r1',
      name: '午夜禁令',
      category: 'world',
      priority: 'hard_constraint',
      enabled: true,
      conditions: [],
      blockers: [],
      effects: [],
      explanation: '午夜不能开北门'
    }
  ]
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

describe('ReviewWorkspace', () => {
  it('shows one section at a time and keeps the preview visible', async () => {
    render(ReviewWorkspace, {
      props: {
        project,
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
        rulePreview
      }
    });

    expect(screen.getByRole('heading', { name: '角色卡' })).toBeInTheDocument();
    expect(screen.getByText('lore 预览')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '世界书' }));

    expect(screen.getByRole('heading', { name: '世界书' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '角色卡' })).not.toBeInTheDocument();
    expect(screen.getByText('lore 预览')).toBeInTheDocument();
  });
});
