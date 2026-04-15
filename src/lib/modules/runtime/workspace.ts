import { get, writable, type Readable } from 'svelte/store';

import * as runtimeBackend from './backend';
import type { RuntimeSnapshot } from '$lib/types';

export type RuntimeWorkspaceStatus = 'loading' | 'ready' | 'error';

export interface RuntimeWorkspaceState {
  sessionId: string;
  status: RuntimeWorkspaceStatus;
  snapshot: RuntimeSnapshot | null;
  freeInput: string;
  busy: boolean;
  busyLabel: string;
  error: string;
}

export interface RuntimeWorkspaceBackend {
  getRuntimeSnapshot(sessionId: string): Promise<RuntimeSnapshot>;
  submitChoice(sessionId: string, choiceId: string): Promise<unknown>;
  submitFreeInput(sessionId: string, text: string): Promise<unknown>;
  rewindToCheckpoint(sessionId: string, checkpointId: string): Promise<unknown>;
  finishSession(sessionId: string): Promise<unknown>;
}

export interface RuntimeWorkspaceController extends Readable<RuntimeWorkspaceState> {
  load(): Promise<void>;
  updateFreeInput(value: string): void;
  choose(choiceId: string): Promise<void>;
  submitFreeInput(): Promise<void>;
  rewind(checkpointId: string): Promise<void>;
  finish(): Promise<void>;
}

function normalizeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function createInitialState(sessionId: string): RuntimeWorkspaceState {
  return {
    sessionId,
    status: 'loading',
    snapshot: null,
    freeInput: '',
    busy: false,
    busyLabel: '',
    error: ''
  };
}

export function createRuntimeWorkspaceController(
  sessionId: string,
  deps: RuntimeWorkspaceBackend = runtimeBackend
): RuntimeWorkspaceController {
  const state = writable<RuntimeWorkspaceState>(createInitialState(sessionId));

  const refreshSnapshot = async (preserveInput = true) => {
    state.update((current) => ({
      ...current,
      status: current.snapshot ? current.status : 'loading',
      error: ''
    }));

    try {
      const snapshot = await deps.getRuntimeSnapshot(sessionId);
      state.update((current) => ({
        ...current,
        status: 'ready',
        snapshot,
        error: '',
        freeInput: preserveInput ? current.freeInput : ''
      }));
    } catch (error) {
      state.update((current) => ({
        ...current,
        status: 'error',
        error: normalizeError(error, '加载互动故事失败')
      }));
    }
  };

  const runAction = async (
    action: () => Promise<unknown>,
    options: {
      clearInputAfterSuccess?: boolean;
      fallbackMessage: string;
      busyLabel: string;
    }
  ) => {
    state.update((current) => ({
      ...current,
      busy: true,
      busyLabel: options.busyLabel,
      error: ''
    }));

    try {
      await action();
      await refreshSnapshot(!options.clearInputAfterSuccess);
    } catch (error) {
      state.update((current) => ({
        ...current,
        busy: false,
        busyLabel: '',
        error: normalizeError(error, options.fallbackMessage)
      }));
      return;
    }

    state.update((current) => ({
      ...current,
      busy: false,
      busyLabel: ''
    }));
  };

  return {
    subscribe: state.subscribe,

    async load() {
      await refreshSnapshot(true);
    },

    updateFreeInput(value: string) {
      state.update((current) => ({
        ...current,
        freeInput: value,
        error: ''
      }));
    },

    async choose(choiceId: string) {
      await runAction(() => deps.submitChoice(sessionId, choiceId), {
        fallbackMessage: '推进剧情失败',
        busyLabel: '正在推进剧情'
      });
    },

    async submitFreeInput() {
      const current = get(state);
      const text = current.freeInput.trim();
      if (!text) {
        return;
      }

      await runAction(() => deps.submitFreeInput(sessionId, text), {
        clearInputAfterSuccess: true,
        fallbackMessage: '写入自由行动失败',
        busyLabel: '正在写入自由行动'
      });
    },

    async rewind(checkpointId: string) {
      await runAction(() => deps.rewindToCheckpoint(sessionId, checkpointId), {
        fallbackMessage: '回溯失败',
        busyLabel: '正在回溯到关键节点'
      });
    },

    async finish() {
      await runAction(() => deps.finishSession(sessionId), {
        fallbackMessage: '完成本轮互动失败',
        busyLabel: '正在归档本轮互动'
      });
    }
  };
}
