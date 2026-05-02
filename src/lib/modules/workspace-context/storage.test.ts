import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearWorkspaceContext,
  loadWorkspaceContext,
  saveWorkspaceContext,
  type WorkspaceContextSnapshot
} from './storage';

function installMockLocalStorage() {
  const storage = new Map<string, string>();
  const localStorageMock = {
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    }
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock
  });
}

describe('workspace context storage', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
  });

  it('round-trips the phase, project, and session return context', () => {
    const snapshot: WorkspaceContextSnapshot = {
      phase: 'reader',
      projectId: 'project-1',
      projectName: '临川夜话',
      sessionId: 'session-1'
    };

    saveWorkspaceContext(snapshot);

    expect(loadWorkspaceContext()).toEqual(snapshot);
  });

  it('clears the saved return context', () => {
    saveWorkspaceContext({
      phase: 'review',
      projectId: 'project-1',
      projectName: '临川夜话',
      sessionId: null
    });

    clearWorkspaceContext();

    expect(loadWorkspaceContext()).toBeNull();
  });
});
