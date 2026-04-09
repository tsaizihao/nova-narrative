import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ImportScreen from './ImportScreen.svelte';

describe('ImportScreen', () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight');
  let mockScrollHeight = 420;

  beforeEach(() => {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return mockScrollHeight;
      }
    });
  });

  afterEach(() => {
    if (originalScrollHeight) {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
  });

  it('auto-resizes the novel textarea so the page keeps a single scroll container', async () => {
    const { rerender } = render(ImportScreen, {
      props: {
        projectName: '临川夜话',
        novelText: '第一章\n'.repeat(20),
        busy: false,
        error: ''
      }
    });

    await tick();

    const textarea = screen.getByRole('textbox', { name: '小说正文' }) as HTMLTextAreaElement;
    expect(textarea.style.height).toBe('420px');
    expect(getComputedStyle(textarea).overflowY).toBe('hidden');

    mockScrollHeight = 220;
    await rerender({
      projectName: '临川夜话',
      novelText: '短文本',
      busy: false,
      error: ''
    });
    await tick();

    expect(textarea.style.height).toBe('320px');
  });
});
