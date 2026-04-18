import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import type {
  NovelProject,
  ReviewPreviewContext,
  ReviewPreviewSnapshot,
  RuleEvaluationResult,
  StoryState
} from '$lib/types';
import { createReviewWorkspaceController } from './workspace';

function createStoryState(): StoryState {
  return {
    current_scene_id: 'scene-1',
    character_states: [],
    fact_records: [],
    relationship_states: {},
    event_flags: [],
    possibility_flags: [],
    unlocked_rules: [],
    visited_scenes: ['scene-1'],
    checkpoints: []
  };
}

function createRulePreview(blocked = false): RuleEvaluationResult {
  return {
    story_state: createStoryState(),
    active_rules: [],
    blocked
  };
}

function createPreviewContext(
  overrides: Partial<ReviewPreviewContext> = {}
): ReviewPreviewContext {
  return {
    sceneId: 'scene-1',
    eventKind: 'open_gate',
    inputText: '午夜去开门',
    actorCharacterId: 'char-1',
    targetCharacterId: null,
    ...overrides
  };
}

function createPreviewSnapshot(
  overrides: Partial<ReviewPreviewSnapshot> = {}
): ReviewPreviewSnapshot {
  const context = createPreviewContext();
  return {
    context,
    lorePreview: [
      {
        entry_id: 'w1',
        title: '北门',
        slot: 'rules_guard',
        matched_keys: ['北门'],
        reason: '命中北门',
        lifecycle_state: 'ready',
        content: '午夜不可开门',
        source: 'extractor',
        rule_binding: null
      }
    ],
    rulePreview: createRulePreview(true),
    projectedOutcome: {
      blocked: true,
      staysOnScene: true,
      nextSceneId: null,
      nextSceneTitle: null,
      nextSceneSummary: null,
      candidateChoices: []
    },
    explanations: {
      loreSummary: '命中 1 条 lore',
      ruleSummary: '存在阻塞规则',
      outcomeSummary: '动作会停留在当前场景'
    },
    ...overrides
  };
}

function createProject(): NovelProject {
  return {
    id: 'project-1',
    name: '临川夜话',
    raw_text: '原文',
    chapters: [],
    build_status: {
      stage: 'ready',
      message: 'Story package ready',
      progress: 100
    },
    story_package: {
      story_bible: {
        title: '临川夜话',
        characters: [],
        locations: [],
        timeline: [],
        world_rules: [],
        relationships: [],
        core_conflicts: []
      },
      world_model: {
        character_cards: [],
        worldbook_entries: [],
        rules: []
      },
      start_scene_id: 'scene-1',
      scenes: {
        'scene-1': {
          id: 'scene-1',
          chapter: 1,
          title: '北门之夜',
          summary: '夜色压城',
          narration: [],
          dialogue: [],
          entry_conditions: [],
          present_characters: [],
          candidate_choices: [],
          fallback_next: null,
          allow_free_input: true,
          checkpoint: false,
          ending: null
        }
      }
    },
    character_cards: [
      {
        id: 'char-1',
        name: '沈砚',
        gender: '男',
        age: 27,
        identity: '巡夜人',
        faction: '巡城司',
        role: '主角',
        summary: '在雨夜追查失踪案。',
        desire: '找回妹妹',
        secrets: ['曾与嫌疑人合作'],
        traits: ['冷静'],
        abilities: ['追踪'],
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
        id: 'rule-1',
        name: '午夜禁令',
        category: 'world',
        priority: 'hard_constraint',
        enabled: true,
        conditions: [],
        blockers: [],
        effects: [],
        explanation: '午夜不能开北门'
      }
    ],
    review_preview_context: createPreviewContext()
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe('review workspace controller', () => {
  it('preserves active selection and unsaved drafts in other sections after save', async () => {
    const project = createProject();
    const savedCharacter = {
      ...project.character_cards[0],
      name: '沈砚（已保存）'
    };
    const refreshedProject: NovelProject = {
      ...project,
      character_cards: [savedCharacter],
      adaptation_kernel: {
        source_novel: {
          title: project.name,
          chapter_count: project.chapters.length,
          chapters: []
        },
        canon_characters: [
          {
            character_id: savedCharacter.id,
            name: savedCharacter.name,
            protected_identity: savedCharacter.identity,
            protected_role: savedCharacter.role,
            anchor_traits: savedCharacter.traits,
            summary: savedCharacter.summary
          }
        ],
        relationship_graph: [],
        event_graph: [],
        world_rules: [
          {
            id: 'rule-1',
            description: '午夜不能开北门'
          }
        ],
        constraints: {
          preserve_character_core: true,
          allow_relationship_rewire: true,
          allow_player_insert: true
        }
      },
      story_package: {
        ...project.story_package!,
        story_bible: {
          ...project.story_package!.story_bible,
          characters: [savedCharacter],
          world_rules: [
            {
              id: 'rule-1',
              description: '午夜不能开北门'
            }
          ]
        },
        world_model: {
          ...project.story_package!.world_model,
          character_cards: [savedCharacter]
        },
        adaptation_kernel: {
          source_novel: {
            title: project.name,
            chapter_count: project.chapters.length,
            chapters: []
          },
          canon_characters: [
            {
              character_id: savedCharacter.id,
              name: savedCharacter.name,
              protected_identity: savedCharacter.identity,
              protected_role: savedCharacter.role,
              anchor_traits: savedCharacter.traits,
              summary: savedCharacter.summary
            }
          ],
          relationship_graph: [],
          event_graph: [],
          world_rules: [
            {
              id: 'rule-1',
              description: '午夜不能开北门'
            }
          ],
          constraints: {
            preserve_character_core: true,
            allow_relationship_rewire: true,
            allow_player_insert: true
          }
        }
      }
    };
    const deps = {
      updateCharacterCard: vi.fn().mockResolvedValue([
        savedCharacter
      ]),
      getProject: vi.fn().mockResolvedValue(refreshedProject),
      upsertWorldBookEntry: vi.fn(),
      deleteWorldBookEntry: vi.fn(),
      upsertRule: vi.fn(),
      deleteRule: vi.fn(),
      previewReviewSnapshot: vi.fn().mockResolvedValue(createPreviewSnapshot()),
      saveReviewPreviewContext: vi.fn().mockResolvedValue(createPreviewContext())
    };
    const workspace = createReviewWorkspaceController(project, deps);

    await Promise.resolve();

    workspace.setActiveSection('worldbook');
    workspace.selectWorldBookEntry('w1');
    workspace.updateWorldBookDraft({
      ...get(workspace).drafts.worldbook.w1,
      title: '北门（未保存草稿）'
    });
    workspace.setActiveSection('characters');
    workspace.selectCharacter('char-1');
    workspace.updateCharacterDraft({
      ...get(workspace).drafts.characters['char-1'],
      name: '沈砚（编辑中）'
    });

    await workspace.saveCharacter();

    const state = get(workspace);
    expect(state.activeSection).toBe('characters');
    const expectedSelection: typeof state.activeSelection = {
      canon: null,
      characters: 'char-1',
      worldbook: 'w1',
      rules: 'rule-1'
    };
    expect(state.activeSelection).toEqual(expectedSelection);
    expect(state.project.character_cards[0].name).toBe('沈砚（已保存）');
    expect(state.project.story_package?.story_bible.characters[0]?.name).toBe('沈砚（已保存）');
    expect(state.project.adaptation_kernel?.canon_characters[0]?.name).toBe('沈砚（已保存）');
    expect(state.drafts.worldbook.w1.title).toBe('北门（未保存草稿）');
    expect(state.preview.status).toBe('stale');
    expect(state.preview.previewSnapshot?.context.sceneId).toBe('scene-1');
    expect(deps.getProject).toHaveBeenCalledWith(project.id);
  });

  it('loads persisted preview context and refreshes aggregated preview', async () => {
    const snapshot = createPreviewSnapshot();
    const workspace = createReviewWorkspaceController(createProject(), {
      updateCharacterCard: vi.fn(),
      getProject: vi.fn(),
      upsertWorldBookEntry: vi.fn(),
      deleteWorldBookEntry: vi.fn(),
      upsertRule: vi.fn(),
      deleteRule: vi.fn(),
      previewReviewSnapshot: vi.fn().mockResolvedValue(snapshot),
      saveReviewPreviewContext: vi.fn().mockResolvedValue(snapshot.context)
    });

    await Promise.resolve();
    await Promise.resolve();

    const state = get(workspace);
    expect(state.preview.previewContextDraft?.sceneId).toBe('scene-1');
    expect(state.preview.previewStatus).toBe('ready');
    expect(state.preview.previewSnapshot?.projectedOutcome.blocked).toBe(true);
    expect(state.preview.appliedPreviewContext?.sceneId).toBe('scene-1');
  });

  it('auto-refreshes aggregated preview when preview context changes and ignores stale results', async () => {
    const first = deferred<ReviewPreviewSnapshot>();
    const second = deferred<ReviewPreviewSnapshot>();
    const saveContext = vi.fn().mockResolvedValue(createPreviewContext({ sceneId: 'scene-1' }));
    const workspace = createReviewWorkspaceController(createProject(), {
      updateCharacterCard: vi.fn(),
      getProject: vi.fn(),
      upsertWorldBookEntry: vi.fn(),
      deleteWorldBookEntry: vi.fn(),
      upsertRule: vi.fn(),
      deleteRule: vi.fn(),
      previewReviewSnapshot: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
      saveReviewPreviewContext: saveContext
    });

    workspace.updatePreviewContext({ inputText: '第一次预览' });
    workspace.updatePreviewContext({ inputText: '第二次预览' });

    expect(get(workspace).preview.previewStatus).toBe('refreshing');

    second.resolve(
      createPreviewSnapshot({
        context: createPreviewContext({ inputText: '第二次预览' }),
        explanations: {
          loreSummary: '第二次',
          ruleSummary: '第二次',
          outcomeSummary: '第二次'
        }
      })
    );
    await Promise.resolve();
    await Promise.resolve();

    first.resolve(
      createPreviewSnapshot({
        context: createPreviewContext({ inputText: '第一次预览' }),
        explanations: {
          loreSummary: '第一次',
          ruleSummary: '第一次',
          outcomeSummary: '第一次'
        }
      })
    );
    await Promise.resolve();
    await Promise.resolve();

    const state = get(workspace);
    expect(state.preview.previewStatus).toBe('ready');
    expect(state.preview.previewSnapshot?.context.inputText).toBe('第二次预览');
    expect(state.preview.appliedPreviewContext?.inputText).toBe('第二次预览');
    expect(saveContext).toHaveBeenCalledTimes(1);
  });

  it('keeps local drafts and the last applied snapshot when preview refresh fails', async () => {
    const appliedSnapshot = createPreviewSnapshot();
    const workspace = createReviewWorkspaceController(createProject(), {
      updateCharacterCard: vi.fn(),
      getProject: vi.fn(),
      upsertWorldBookEntry: vi.fn(),
      deleteWorldBookEntry: vi.fn(),
      upsertRule: vi.fn(),
      deleteRule: vi.fn(),
      previewReviewSnapshot: vi
        .fn()
        .mockResolvedValueOnce(appliedSnapshot)
        .mockRejectedValueOnce(new Error('preview offline')),
      saveReviewPreviewContext: vi.fn().mockResolvedValue(appliedSnapshot.context)
    });

    await Promise.resolve();
    await Promise.resolve();

    workspace.updateCharacterDraft({
      ...get(workspace).drafts.characters['char-1'],
      summary: '仍应保留的本地草稿'
    });

    await workspace.refreshPreview();

    const state = get(workspace);
    expect(state.preview.previewStatus).toBe('error');
    expect(state.preview.previewError).toBe('preview offline');
    expect(state.drafts.characters['char-1'].summary).toBe('仍应保留的本地草稿');
    expect(state.preview.previewSnapshot?.context.sceneId).toBe('scene-1');
  });
});
