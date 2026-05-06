import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearWorkspaceContext,
  loadWorkspaceContext,
  saveWorkspaceContext,
  type WorkspaceContextSnapshot
} from './storage';

const STORAGE_KEY = 'nova.workspace-context';

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

  it('returns null when the key is missing', () => {
    expect(loadWorkspaceContext()).toBeNull();
  });

  it('returns null when the saved value is malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{');

    expect(loadWorkspaceContext()).toBeNull();
  });

  it('returns null when the saved phase is invalid', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phase: 'draft',
        projectId: 'project-1',
        projectName: '临川夜话',
        sessionId: 'session-1'
      })
    );

    expect(loadWorkspaceContext()).toBeNull();
  });

  it('normalizes invalid persisted field types to safe values', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phase: 'reader',
        projectId: 42,
        projectName: { title: '临川夜话' },
        sessionId: ['session-1']
      })
    );

    expect(loadWorkspaceContext()).toEqual({
      phase: 'reader',
      projectId: null,
      projectName: '',
      sessionId: null
    });
  });

  it('returns null and no-ops when storage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked');
      }
    });

    expect(() =>
      saveWorkspaceContext({
        phase: 'reader',
        projectId: 'project-1',
        projectName: '临川夜话',
        sessionId: null
      })
    ).not.toThrow();
    expect(() => clearWorkspaceContext()).not.toThrow();
    expect(loadWorkspaceContext()).toBeNull();
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(loadWorkspaceContext()).toBeNull();
  });

  it('does not throw when setItem throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded');
    });

    expect(() =>
      saveWorkspaceContext({
        phase: 'reader',
        projectId: 'project-1',
        projectName: '临川夜话',
        sessionId: null
      })
    ).not.toThrow();
  });

  it('does not throw when removeItem throws', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(() => clearWorkspaceContext()).not.toThrow();
  });
});
