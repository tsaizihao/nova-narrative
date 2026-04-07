import { describe, expect, it } from 'vitest';

import { buildStageCards } from '$lib/story-helpers';
import type { BuildStatus } from '$lib/types';

describe('buildStageCards', () => {
  it('marks completed, current and upcoming build phases in order', () => {
    const status: BuildStatus = {
      stage: 'compiling',
      message: 'Compiling scene graph',
      progress: 80
    };

    const cards = buildStageCards(status);

    expect(cards.map((card) => [card.key, card.status])).toEqual([
      ['imported', 'done'],
      ['analyzing', 'done'],
      ['compiling', 'current'],
      ['ready', 'upcoming']
    ]);
  });

  it('surfaces failure on the current stage', () => {
    const status: BuildStatus = {
      stage: 'failed',
      message: 'Provider timeout',
      progress: 64,
      error: 'Provider timeout'
    };

    const cards = buildStageCards(status);

    expect(cards.at(-1)).toEqual({
      key: 'failed',
      label: '生成失败',
      status: 'error'
    });
  });
});
