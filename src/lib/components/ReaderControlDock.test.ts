import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import ReaderControlDock from './ReaderControlDock.svelte';
import type { SceneNode } from '$lib/types';

function createScene(choices: SceneNode['candidate_choices']): SceneNode {
  return {
    id: 'scene-1',
    chapter: 1,
    title: '北门之夜',
    summary: '夜色压城',
    narration: ['第一段'],
    dialogue: [],
    entry_conditions: [],
    present_characters: [],
    candidate_choices: choices,
    fallback_next: null,
    allow_free_input: true,
    checkpoint: true,
    ending: null
  };
}

describe('ReaderControlDock', () => {
  it('maps a single unlocked choice to the primary continue action', async () => {
    const choose = vi.fn();
    render(ReaderControlDock, {
      props: {
        scene: createScene([
          {
            id: 'choice-1',
            label: '前往北门',
            intent_tag: 'inspect',
            state_effects: [],
            unlock_conditions: [],
            next_scene_id: 'scene-2'
          }
        ]),
        ruleFlags: [],
        freeInput: '',
        busy: false,
        busyLabel: '',
        error: '',
        autoplay: false,
        retryAvailable: false
      },
      events: {
        choose: (event) => choose(event.detail)
      }
    });

    expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(choose).toHaveBeenCalledWith('choice-1');
  });

  it('renders explicit branch buttons when more than one choice is available', () => {
    render(ReaderControlDock, {
      props: {
        scene: createScene([
          {
            id: 'choice-1',
            label: '前往北门',
            intent_tag: 'inspect',
            state_effects: [],
            unlock_conditions: [],
            next_scene_id: 'scene-2'
          },
          {
            id: 'choice-2',
            label: '转向内院',
            intent_tag: 'retreat',
            state_effects: [],
            unlock_conditions: [],
            next_scene_id: 'scene-3'
          }
        ]),
        ruleFlags: [],
        freeInput: '我先稳住对方',
        busy: false,
        busyLabel: '',
        error: '上一轮推进失败',
        autoplay: true,
        retryAvailable: true
      }
    });

    expect(screen.queryByRole('button', { name: '继续' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前往北门' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转向内院' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自动播放' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '重试' })).toHaveAttribute('data-state', 'alert');
    expect(screen.getByRole('status')).toHaveTextContent('上一轮推进失败');
    expect(screen.getByRole('button', { name: '清除输入' })).toBeInTheDocument();
  });

  it('dispatches free input and control events', async () => {
    const freeInputChange = vi.fn();
    const submitFreeInput = vi.fn();
    const clearInput = vi.fn();
    const retry = vi.fn();
    const toggleAutoplay = vi.fn();
    render(ReaderControlDock, {
      props: {
        scene: createScene([
          {
            id: 'choice-1',
            label: '前往北门',
            intent_tag: 'inspect',
            state_effects: [],
            unlock_conditions: [],
            next_scene_id: 'scene-2'
          }
        ]),
        ruleFlags: [],
        freeInput: '我先稳住对方',
        busy: false,
        busyLabel: '',
        error: '',
        autoplay: false,
        retryAvailable: true
      },
      events: {
        freeInputChange: (event) => freeInputChange(event.detail),
        submitFreeInput: () => submitFreeInput(),
        clearInput: () => clearInput(),
        retry: () => retry(),
        toggleAutoplay: () => toggleAutoplay()
      }
    });

    await fireEvent.input(screen.getByRole('textbox'), { target: { value: '继续试探' } });
    expect(freeInputChange).toHaveBeenCalledWith('继续试探');

    await fireEvent.click(screen.getByRole('button', { name: '把这句话写进故事' }));
    expect(submitFreeInput).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole('button', { name: '清除输入' }));
    expect(clearInput).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(retry).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole('button', { name: '自动播放' }));
    expect(toggleAutoplay).toHaveBeenCalledTimes(1);
  });

  it('applies disabled states for busy, retry availability and unlock conditions', () => {
    render(ReaderControlDock, {
      props: {
        scene: createScene([
          {
            id: 'choice-1',
            label: '前往北门',
            intent_tag: 'inspect',
            state_effects: [],
            unlock_conditions: ['need-flag'],
            next_scene_id: 'scene-2'
          }
        ]),
        ruleFlags: [],
        freeInput: '  ',
        busy: true,
        busyLabel: '推进中',
        error: '',
        autoplay: false,
        retryAvailable: false
      }
    });

    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重试' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '清除输入' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '推进中' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('disables a choice when unlock conditions are missing even if not busy', () => {
    render(ReaderControlDock, {
      props: {
        scene: createScene([
          {
            id: 'choice-1',
            label: '前往北门',
            intent_tag: 'inspect',
            state_effects: [],
            unlock_conditions: ['need-flag'],
            next_scene_id: 'scene-2'
          }
        ]),
        ruleFlags: [],
        freeInput: '',
        busy: false,
        busyLabel: '',
        error: '',
        autoplay: false,
        retryAvailable: true
      }
    });

    expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重试' })).not.toBeDisabled();
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  it('keeps free-input area rendered even when scene disallows free input', () => {
    render(ReaderControlDock, {
      props: {
        scene: {
          ...createScene([
            {
              id: 'choice-1',
              label: '前往北门',
              intent_tag: 'inspect',
              state_effects: [],
              unlock_conditions: [],
              next_scene_id: 'scene-2'
            }
          ]),
          allow_free_input: false
        },
        ruleFlags: [],
        freeInput: '',
        busy: false,
        busyLabel: '',
        error: '',
        autoplay: false,
        retryAvailable: false
      }
    });

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '把这句话写进故事' })).toBeDisabled();
  });
});
