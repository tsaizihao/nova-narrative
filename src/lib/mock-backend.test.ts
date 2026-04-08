import { beforeEach, describe, expect, it, vi } from 'vitest';

const novelText = ['第1章 雨夜', '', '沈砚站在门前。', '', '第2章 门后', '', '宁昭低声追问。'].join('\n');

async function loadMockBackend() {
  vi.resetModules();
  return import('./mock-backend');
}

describe('mockBackend project summaries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when there is no recent project yet', async () => {
    const { mockBackend } = await loadMockBackend();

    await expect(mockBackend.get_recent_project()).resolves.toBeNull();
    await expect(mockBackend.list_projects()).resolves.toEqual([]);
  });

  it('sorts projects by last_opened_at and prefers the most recently opened one', async () => {
    const { mockBackend } = await loadMockBackend();

    const first = await mockBackend.create_project('第一个项目');
    await mockBackend.create_project('第二个项目');
    await mockBackend.import_novel_text(first.id, novelText);
    await mockBackend.build_story_package(first.id);
    await mockBackend.get_project(first.id);

    const recent = await mockBackend.get_recent_project();
    const projects = await mockBackend.list_projects();

    expect(recent?.id).toBe(first.id);
    expect(projects).toHaveLength(2);
    expect(projects[0]?.id).toBe(first.id);
    expect(projects[0]?.has_story_package).toBe(true);
    expect(projects[1]?.name).toBe('第二个项目');
    expect(projects[1]?.has_story_package).toBe(false);
  });
});
