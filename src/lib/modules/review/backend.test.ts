import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeCommand = vi.fn();

vi.mock('$lib/backend/commandClient', () => ({
  invokeCommand
}));

describe('review backend', () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it('requests aggregated review preview through the shared command client', async () => {
    const { previewReviewSnapshot } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({
      context: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: 'character-1',
        targetCharacterId: 'character-2'
      },
      lorePreview: [],
      rulePreview: {
        blocked: false,
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
      },
      projectedOutcome: {
        blocked: false,
        staysOnScene: false,
        nextSceneId: 'scene-2',
        nextSceneTitle: '北门开启',
        nextSceneSummary: '门后的真相终于显露。',
        candidateChoices: []
      },
      explanations: {
        loreSummary: '没有新增 lore 命中',
        ruleSummary: '没有规则阻止当前动作',
        outcomeSummary: '动作会推进到 scene-2'
      }
    });

    await previewReviewSnapshot('project-1', {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    });

    expect(invokeCommand).toHaveBeenCalledWith('preview_review_snapshot', {
      projectId: 'project-1',
      context: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: 'character-1',
        targetCharacterId: 'character-2'
      }
    });
  });

  it('requests preview-context persistence through the shared command client', async () => {
    const { saveReviewPreviewContext } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    });

    await saveReviewPreviewContext('project-1', {
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      inputText: '午夜去开门',
      actorCharacterId: 'character-1',
      targetCharacterId: 'character-2'
    });

    expect(invokeCommand).toHaveBeenCalledWith('save_review_preview_context', {
      projectId: 'project-1',
      context: {
        sceneId: 'scene-1',
        eventKind: 'open_gate',
        inputText: '午夜去开门',
        actorCharacterId: 'character-1',
        targetCharacterId: 'character-2'
      }
    });
  });

  it('requests rule preview through the shared command client', async () => {
    const { previewRuleEvaluation } = await import('./backend');

    invokeCommand.mockResolvedValueOnce({ blocked: false });

    await previewRuleEvaluation('project-1', 'scene-1', 'open_gate', undefined, undefined, '午夜去开门');

    expect(invokeCommand).toHaveBeenCalledWith('preview_rule_evaluation', {
      projectId: 'project-1',
      sceneId: 'scene-1',
      eventKind: 'open_gate',
      actorCharacterId: undefined,
      targetCharacterId: undefined,
      inputText: '午夜去开门'
    });
  });
});
