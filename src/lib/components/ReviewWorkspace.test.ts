import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import ReviewWorkspace from './ReviewWorkspace.svelte';
import type {
  NovelProject,
  ReviewPreviewContext,
  ReviewPreviewSnapshot,
  RuleEvaluationResult,
  StoryState
} from '$lib/types';
import type { ReviewWorkspaceState } from '$lib/modules/review/workspace';

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
  adaptation_kernel: {
    source_novel: {
      title: '北门夜话',
      chapter_count: 1,
      chapters: [{ chapter_id: 'chapter-1', title: '第1章 雨夜', excerpt: '沈砚在门前。' }]
    },
    canon_characters: [
      {
        character_id: 'c1',
        name: '阿遥',
        protected_identity: '医生',
        protected_role: '主角',
        anchor_traits: ['冷静', '克制'],
        summary: '冷静克制'
      }
    ],
    relationship_graph: [{ source: '阿遥', target: '北门', label: '调查', strength: 2 }],
    event_graph: [
      {
        event_id: 'event-chapter-1',
        chapter_id: 'chapter-1',
        title: '第1章 雨夜',
        summary: '沈砚在门前。',
        locked: true
      }
    ],
    world_rules: [{ id: 'rule-1', description: '午夜不能开门' }],
    constraints: {
      preserve_character_core: true,
      allow_relationship_rewire: true,
      allow_player_insert: true
    }
  },
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

const previewContext: ReviewPreviewContext = {
  sceneId: 'scene-1',
  eventKind: 'open_gate',
  inputText: '午夜去开门',
  actorCharacterId: 'c1',
  targetCharacterId: null
};

const previewSnapshot: ReviewPreviewSnapshot = {
  context: previewContext,
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
  rulePreview,
  projectedOutcome: {
    blocked: false,
    staysOnScene: false,
    nextSceneId: 'scene-2',
    nextSceneTitle: '门后回声',
    nextSceneSummary: '故事进入下一幕',
    candidateChoices: []
  },
  explanations: {
    loreSummary: '命中 1 条 lore',
    ruleSummary: '没有规则阻止当前动作',
    outcomeSummary: '动作会推进到《门后回声》'
  }
};

function createState(overrides: Partial<ReviewWorkspaceState> = {}): ReviewWorkspaceState {
  return {
    project,
    activeSection: 'characters',
    activeSelection: {
      canon: null,
      characters: 'c1',
      worldbook: 'w1',
      rules: 'r1'
    },
    drafts: {
      characters: {
        c1: { ...project.character_cards[0] }
      },
      worldbook: {
        w1: { ...project.worldbook_entries[0] }
      },
      rules: {
        r1: { ...project.rules[0] }
      }
    },
    dirty: {
      characters: { c1: false },
      worldbook: { w1: false },
      rules: { r1: false }
    },
    saveBusySection: null,
    deleteBusySection: null,
    error: '',
    preview: {
      previewContextDraft: previewContext,
      appliedPreviewContext: previewContext,
      previewSnapshot,
      previewStatus: 'ready',
      previewError: '',
      requestVersion: 1
    },
    ...overrides
  };
}

describe('ReviewWorkspace', () => {
  it('renders the canon section without hiding the preview rail', async () => {
    render(ReviewWorkspace, {
      props: {
        state: createState({
          activeSection: 'canon',
          activeSelection: {
            ...createState().activeSelection,
            canon: null
          }
        })
      }
    });

    expect(screen.getByRole('heading', { name: '原著内核' })).toBeInTheDocument();
    expect(screen.getByText('人物性格锚点')).toBeInTheDocument();
    expect(screen.getByText('北门夜话')).toBeInTheDocument();
    expect(screen.getByText('保留人物核心')).toBeInTheDocument();
    expect(screen.getByTestId('review-preview-rail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存更改' })).not.toBeInTheDocument();
  });

  it('dispatches canon tab selection through controlled state', async () => {
    const sectionChange = vi.fn();

    render(ReviewWorkspace, {
      props: {
        state: createState()
      },
      events: {
        setActiveSection: sectionChange
      }
    });

    await fireEvent.click(screen.getByRole('button', { name: '原著内核' }));

    expect(sectionChange).toHaveBeenCalledTimes(1);
    expect(sectionChange.mock.calls[0][0].detail).toBe('canon');
  });

  it('renders from controlled review state and keeps preview visible', async () => {
    render(ReviewWorkspace, {
      props: {
        state: createState({
          activeSection: 'rules'
        })
      }
    });

    expect(screen.getByRole('heading', { name: '规则编辑' })).toBeInTheDocument();
    expect(screen.getByTestId('review-editor-column')).toBeInTheDocument();
    expect(screen.getByTestId('review-preview-rail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存更改' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /午夜禁令/ })).toBeInTheDocument();
    expect(screen.getByText('预览已就绪')).toBeInTheDocument();
    expect(screen.getByText('动作会推进到《门后回声》')).toBeInTheDocument();
  });

  it('dispatches controlled actions instead of mutating local section state', async () => {
    const sectionChange = vi.fn();
    const updateContext = vi.fn();

    render(ReviewWorkspace, {
      props: {
        state: createState()
      },
      events: {
        setActiveSection: sectionChange,
        updatePreviewContext: updateContext
      }
    });

    expect(screen.getByRole('heading', { name: '角色卡' })).toBeInTheDocument();
    expect(screen.getByText('lore 预览')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '世界书' }));
    await fireEvent.change(screen.getByLabelText('事件类型'), {
      target: { value: 'seek_truth' }
    });

    expect(sectionChange).toHaveBeenCalledTimes(1);
    expect(sectionChange.mock.calls[0][0].detail).toBe('worldbook');
    expect(updateContext).toHaveBeenCalledTimes(1);
    expect(updateContext.mock.calls[0][0].detail).toEqual({ eventKind: 'seek_truth' });
    expect(screen.getByRole('heading', { name: '角色卡' })).toBeInTheDocument();
    expect(screen.getByText('lore 预览')).toBeInTheDocument();
  });
});
