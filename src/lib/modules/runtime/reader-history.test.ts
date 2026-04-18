import { describe, expect, it } from 'vitest';

import {
  appendReaderSnapshot,
  createReaderHistory,
  resetReaderHistory
} from './reader-history';
import type { RuntimeSnapshot } from '$lib/types';

function createSnapshot(sceneId: string, title: string): RuntimeSnapshot {
  return {
    payload: {
      scene: {
        id: sceneId,
        chapter: sceneId === 'scene-1' ? 1 : 2,
        title,
        summary: `${title} 摘要`,
        narration: [`${title} 旁白`],
        dialogue: [
          {
            speaker: '林冲',
            emotion: '克制',
            text: `${title} 对白`
          }
        ],
        entry_conditions: [],
        present_characters: ['linchong'],
        candidate_choices: [],
        fallback_next: null,
        allow_free_input: false,
        checkpoint: true,
        ending: null
      },
      session: {
        session_id: 'session-1',
        project_id: 'project-1',
        current_scene_id: sceneId,
        visited_scenes: sceneId === 'scene-1' ? ['scene-1'] : ['scene-1', sceneId],
        known_facts: [],
        relationship_deltas: {},
        rule_flags: [],
        major_choices: [],
        available_checkpoints: [],
        free_input_history: [],
        ending_report: null,
        story_state: {
          current_scene_id: sceneId,
          character_states: [],
          fact_records: [],
          relationship_states: {},
          event_flags: [],
          possibility_flags: [],
          unlocked_rules: [],
          visited_scenes: sceneId === 'scene-1' ? ['scene-1'] : ['scene-1', sceneId],
          checkpoints: []
        },
        lore_lifecycle: [],
        last_active_rules: []
      },
      active_lore: [],
      active_rules: [
        {
          rule_id: `rule-${sceneId}`,
          name: `${title} 规则`,
          priority: 'soft_constraint',
          explanation: `${title} 规则解释`,
          effects: [],
          reason: `${title} 命中`
        }
      ],
      story_state: {
        current_scene_id: sceneId,
        character_states: [],
        fact_records: [],
        relationship_states: {},
        event_flags: [],
        possibility_flags: [],
        unlocked_rules: [],
        visited_scenes: sceneId === 'scene-1' ? ['scene-1'] : ['scene-1', sceneId],
        checkpoints: []
      }
    },
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
}

describe('reader-history', () => {
  it('creates one current block from the first snapshot', () => {
    const history = createReaderHistory(createSnapshot('scene-1', '北门之夜'));

    expect(history.currentSceneId).toBe('scene-1');
    expect(history.blocks).toHaveLength(1);
    expect(history.blocks[0]).toMatchObject({
      sceneId: 'scene-1',
      title: '北门之夜',
      isCurrent: true
    });
  });

  it('appends a new block for a new scene but replaces reloads of the same scene', () => {
    const first = createReaderHistory(createSnapshot('scene-1', '北门之夜'));
    const appended = appendReaderSnapshot(first, createSnapshot('scene-2', '第二幕'));
    const refreshed = appendReaderSnapshot(appended, createSnapshot('scene-2', '第二幕'));

    expect(appended.blocks.map((block) => block.sceneId)).toEqual(['scene-1', 'scene-2']);
    expect(refreshed.blocks).toHaveLength(2);
    expect(refreshed.blocks[1].isCurrent).toBe(true);
    expect(refreshed.blocks[0].isCurrent).toBe(false);
  });

  it('resets back to one current block after a rewind-style reset', () => {
    const appended = appendReaderSnapshot(
      createReaderHistory(createSnapshot('scene-1', '北门之夜')),
      createSnapshot('scene-2', '第二幕')
    );
    const reset = resetReaderHistory(createSnapshot('scene-1', '北门之夜'));

    expect(appended.blocks).toHaveLength(2);
    expect(reset.blocks).toHaveLength(1);
    expect(reset.blocks[0].sceneId).toBe('scene-1');
  });
});
