import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearImportDraft,
  loadImportDraft,
  saveImportDraft,
  type ImportDraftSnapshot
} from './storage';

const STORAGE_KEY = 'nova.import-draft';

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

  return localStorageMock;
}

describe('import draft storage', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
  });

  it('round-trips the current project name, novel text, and settings prompt', () => {
    const snapshot: ImportDraftSnapshot = {
      projectName: '临川夜话',
      novelText: '第1章 雨夜来客',
      settingsPrompt: '当前模型尚未完成配置，请先补全 AI 设置。'
    };

    saveImportDraft(snapshot);

    expect(loadImportDraft()).toEqual(snapshot);
  });

  it('clears the saved draft', () => {
    saveImportDraft({
      projectName: '临川夜话',
      novelText: '第1章 雨夜来客',
      settingsPrompt: null
    });

    clearImportDraft();

    expect(loadImportDraft()).toEqual({
      projectName: '',
      novelText: '',
      settingsPrompt: null
    });
  });

  it('returns an empty draft when the key is missing', () => {
    expect(loadImportDraft()).toEqual({
      projectName: '',
      novelText: '',
      settingsPrompt: null
    });
  });

  it('returns an empty draft when the saved value is malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{');

    expect(loadImportDraft()).toEqual({
      projectName: '',
      novelText: '',
      settingsPrompt: null
    });
  });

  it('falls back field-by-field when persisted JSON has invalid value types', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectName: 42,
        novelText: { x: 1 },
        settingsPrompt: 'ok'
      })
    );

    expect(loadImportDraft()).toEqual({
      projectName: '',
      novelText: '',
      settingsPrompt: 'ok'
    });
  });

  it('returns an empty draft and no-ops when storage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked');
      }
    });

    expect(() => saveImportDraft({
      projectName: '临川夜话',
      novelText: '第1章 雨夜来客',
      settingsPrompt: null
    })).not.toThrow();
    expect(() => clearImportDraft()).not.toThrow();
    expect(loadImportDraft()).toEqual({
      projectName: '',
      novelText: '',
      settingsPrompt: null
    });
  });

  it('returns an empty draft when getItem throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(loadImportDraft()).toEqual({
      projectName: '',
      novelText: '',
      settingsPrompt: null
    });
  });

  it('does not throw when setItem throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded');
    });

    expect(() => saveImportDraft({
      projectName: '临川夜话',
      novelText: '第1章 雨夜来客',
      settingsPrompt: null
    })).not.toThrow();
  });

  it('does not throw when removeItem throws', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(() => clearImportDraft()).not.toThrow();
  });
});
