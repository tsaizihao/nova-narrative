import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import { createRuntimeWorkspaceController } from './workspace';
import type { RuntimeSnapshot } from '$lib/types';

function createSnapshot(overrides: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot {
  return {
    payload: {
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
    },
    ...overrides
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

describe('runtime workspace', () => {
  it('loads a unified runtime snapshot for the active session', async () => {
    const deps = {
      getRuntimeSnapshot: vi.fn().mockResolvedValue(createSnapshot()),
      submitChoice: vi.fn(),
      submitFreeInput: vi.fn(),
      rewindToCheckpoint: vi.fn()
    };

    const controller = createRuntimeWorkspaceController('session-1', deps);
    await controller.load();

    expect(deps.getRuntimeSnapshot).toHaveBeenCalledWith('session-1');
    expect(get(controller).snapshot?.payload.scene.title).toBe('北门之夜');
    expect(get(controller).status).toBe('ready');
  });

  it('submits free input, clears the draft, and refreshes the snapshot', async () => {
    const refreshed = createSnapshot({
      payload: {
        ...createSnapshot().payload,
        session: {
          ...createSnapshot().payload.session,
          free_input_history: ['我先稳住对方']
        }
      }
    });
    const deps = {
      getRuntimeSnapshot: vi.fn().mockResolvedValue(refreshed),
      submitChoice: vi.fn(),
      submitFreeInput: vi.fn().mockResolvedValue(undefined),
      rewindToCheckpoint: vi.fn()
    };

    const controller = createRuntimeWorkspaceController('session-1', deps);
    await controller.load();
    controller.updateFreeInput('我先稳住对方');
    await controller.submitFreeInput();

    expect(deps.submitFreeInput).toHaveBeenCalledWith('session-1', '我先稳住对方');
    expect(deps.getRuntimeSnapshot).toHaveBeenCalledTimes(2);
    expect(get(controller).freeInput).toBe('');
    expect(get(controller).snapshot?.payload.session.free_input_history).toEqual(['我先稳住对方']);
  });

  it('exposes a rewind-specific busy message while rewinding to a checkpoint', async () => {
    const pending = deferred<void>();
    const deps = {
      getRuntimeSnapshot: vi.fn().mockResolvedValue(createSnapshot()),
      submitChoice: vi.fn(),
      submitFreeInput: vi.fn(),
      rewindToCheckpoint: vi.fn().mockReturnValue(pending.promise)
    };

    const controller = createRuntimeWorkspaceController('session-1', deps);
    await controller.load();

    const rewindPromise = controller.rewind('checkpoint-1');

    expect(get(controller).busy).toBe(true);
    expect(get(controller).busyLabel).toBe('正在回溯到关键节点');

    pending.resolve();
    await rewindPromise;
  });

  it('can recover from a failed snapshot load when load is retried', async () => {
    const deps = {
      getRuntimeSnapshot: vi
        .fn()
        .mockRejectedValueOnce(new Error('snapshot unavailable'))
        .mockResolvedValueOnce(createSnapshot()),
      submitChoice: vi.fn(),
      submitFreeInput: vi.fn(),
      rewindToCheckpoint: vi.fn()
    };

    const controller = createRuntimeWorkspaceController('session-1', deps);

    await controller.load();
    expect(get(controller).status).toBe('error');
    expect(get(controller).error).toBe('snapshot unavailable');

    await controller.load();
    expect(get(controller).status).toBe('ready');
    expect(get(controller).error).toBe('');
    expect(get(controller).snapshot?.payload.scene.title).toBe('北门之夜');
  });
});
