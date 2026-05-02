import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearImportDraft,
  loadImportDraft,
  saveImportDraft,
  type ImportDraftSnapshot
} from './storage';

describe('import draft storage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
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
      }
    });
  });

  beforeEach(() => {
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
});
