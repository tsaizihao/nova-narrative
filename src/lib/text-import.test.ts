import { describe, expect, it } from 'vitest';

import { readImportedTextFile } from './text-import';

describe('readImportedTextFile', () => {
  it('reads txt content and derives a suggested project name from the filename', async () => {
    const file = new File(['第1章 雨夜来客\n\n沈砚站在门前。'], '临川夜话.txt', {
      type: 'text/plain'
    });

    await expect(readImportedTextFile(file)).resolves.toEqual({
      content: '第1章 雨夜来客\n\n沈砚站在门前。',
      suggestedName: '临川夜话'
    });
  });

  it('rejects non-txt files', async () => {
    const file = new File(['not plain text'], 'story.md', { type: 'text/markdown' });

    await expect(readImportedTextFile(file)).rejects.toThrow('目前只支持导入 .txt 纯文本文件');
  });

  it('rejects empty txt files', async () => {
    const file = new File(['   \n\t'], 'empty.txt', { type: 'text/plain' });

    await expect(readImportedTextFile(file)).rejects.toThrow('导入的 txt 文件为空');
  });

  it('rejects txt files that contain control characters', async () => {
    const file = new File(['\u0000binary-ish'], 'broken.txt', { type: 'text/plain' });

    await expect(readImportedTextFile(file)).rejects.toThrow('导入的文件不像可读取的纯文本内容');
  });
});
