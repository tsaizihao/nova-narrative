import { describe, expect, it } from 'vitest';

import { readImportedTextFile } from './text-import';

describe('readImportedTextFile', () => {
  it('reads plain txt content and derives a project name from the file name', async () => {
    const file = new File(['第一章 风起\n第二章 雨落'], '临川夜话.txt', { type: 'text/plain' });

    await expect(readImportedTextFile(file)).resolves.toEqual({
      content: '第一章 风起\n第二章 雨落',
      suggestedName: '临川夜话'
    });
  });

  it('rejects empty txt files with a clear error message', async () => {
    const file = new File(['   \n\t'], '空白小说.txt', { type: 'text/plain' });

    await expect(readImportedTextFile(file)).rejects.toThrow('导入的 txt 文件为空');
  });

  it('rejects files that are not txt', async () => {
    const file = new File(['not-a-text-file'], '故事.pdf', { type: 'application/pdf' });

    await expect(readImportedTextFile(file)).rejects.toThrow('目前只支持导入 .txt 纯文本文件');
  });

  it('rejects binary-looking txt files', async () => {
    const file = new File(['\u0000\u0001\u0002PNG'], '截图.txt', { type: 'text/plain' });

    await expect(readImportedTextFile(file)).rejects.toThrow('导入的文件不像可读取的纯文本内容');
  });
});
