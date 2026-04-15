import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeBackend = vi.hoisted(() => ({
  getRuntimeSnapshot: vi.fn(),
  submitChoice: vi.fn(),
  submitFreeInput: vi.fn(),
  rewindToCheckpoint: vi.fn()
}));

vi.mock('$lib/modules/runtime/backend', () => runtimeBackend);

import RuntimeStageShell from './RuntimeStageShell.svelte';
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

describe('RuntimeStageShell', () => {
  beforeEach(() => {
    runtimeBackend.getRuntimeSnapshot.mockReset();
    runtimeBackend.submitChoice.mockReset();
    runtimeBackend.submitFreeInput.mockReset();
    runtimeBackend.rewindToCheckpoint.mockReset();
  });

  it('loads a runtime snapshot and renders the desktop reader shell', async () => {
    runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createSnapshot());

    const { container } = render(RuntimeStageShell, {
      props: {
        sessionId: 'session-1',
        layoutMode: 'desktop'
      }
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '北门之夜' })).toBeInTheDocument();
    });
    expect(runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledWith('session-1');
    expect(container.querySelector('.reader-desktop')).toBeInTheDocument();
  });

  it('shows a shell-level busy lane while a choice action is in flight', async () => {
    const pending = deferred<void>();
    runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createSnapshot());
    runtimeBackend.submitChoice.mockReturnValue(pending.promise);

    render(RuntimeStageShell, {
      props: {
        sessionId: 'session-1',
        layoutMode: 'desktop'
      }
    });

    await screen.findByRole('heading', { name: '北门之夜' });
    await fireEvent.click(screen.getByRole('button', { name: '前往北门' }));

    const feedbackLane = await screen.findByTestId('runtime-feedback-lane');
    expect(within(feedbackLane).getByText('正在推进剧情')).toBeInTheDocument();

    pending.resolve();
    await waitFor(() => {
      expect(screen.queryByTestId('runtime-feedback-lane')).not.toBeInTheDocument();
    });
  });

  it('offers a retry action after the initial runtime load fails', async () => {
    runtimeBackend.getRuntimeSnapshot
      .mockRejectedValueOnce(new Error('snapshot unavailable'))
      .mockResolvedValueOnce(createSnapshot());

    render(RuntimeStageShell, {
      props: {
        sessionId: 'session-1',
        layoutMode: 'desktop'
      }
    });

    await screen.findByTestId('runtime-error-state');
    expect(screen.getByText('snapshot unavailable')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '重新载入当前场景' }));

    await screen.findByRole('heading', { name: '北门之夜' });
    expect(runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('allows reloading the current snapshot after an in-reader action fails', async () => {
    runtimeBackend.getRuntimeSnapshot
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot());
    runtimeBackend.submitChoice.mockRejectedValueOnce(new Error('choice failed'));

    render(RuntimeStageShell, {
      props: {
        sessionId: 'session-1',
        layoutMode: 'desktop'
      }
    });

    await screen.findByRole('heading', { name: '北门之夜' });
    await fireEvent.click(screen.getByRole('button', { name: '前往北门' }));

    const feedbackLane = await screen.findByTestId('runtime-feedback-lane');
    expect(within(feedbackLane).getByText('choice failed')).toBeInTheDocument();

    await fireEvent.click(within(feedbackLane).getByRole('button', { name: '重新载入当前场景' }));

    await waitFor(() => {
      expect(screen.queryByTestId('runtime-feedback-lane')).not.toBeInTheDocument();
    });
    expect(runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('dispatches a review-return action without reloading the runtime snapshot', async () => {
    runtimeBackend.getRuntimeSnapshot.mockResolvedValue(createSnapshot());
    const exitReader = vi.fn();

    render(RuntimeStageShell, {
      props: {
        sessionId: 'session-1',
        layoutMode: 'desktop'
      },
      events: {
        exitReader
      }
    });

    await screen.findByRole('heading', { name: '北门之夜' });
    await fireEvent.click(screen.getByRole('button', { name: '返回审阅台' }));

    expect(exitReader).toHaveBeenCalledTimes(1);
    expect(runtimeBackend.getRuntimeSnapshot).toHaveBeenCalledTimes(1);
  });
});
