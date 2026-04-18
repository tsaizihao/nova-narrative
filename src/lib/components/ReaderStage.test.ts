import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ReaderStage from './ReaderStage.svelte';
import type { ReaderSceneBlock } from '$lib/modules/runtime/reader-history';

const blocks: ReaderSceneBlock[] = [
  {
    id: 'scene-1-1',
    sceneId: 'scene-1',
    chapter: 1,
    title: '北门之夜',
    summary: '夜色压城',
    narration: ['第一段旁白', '第二段旁白'],
    dialogue: [
      {
        speaker: '林冲',
        emotion: '克制',
        text: '我先看看城门外。'
      }
    ],
    activeRules: [
      {
        rule_id: 'rule-1',
        name: '午夜禁令',
        priority: 'hard_constraint',
        explanation: '午夜不能开门',
        effects: [],
        reason: '命中午夜'
      }
    ],
    visitedCount: 1,
    isCurrent: false
  },
  {
    id: 'scene-2-2',
    sceneId: 'scene-2',
    chapter: 2,
    title: '第二幕',
    summary: '风更紧了',
    narration: ['第三段旁白'],
    dialogue: [],
    activeRules: [],
    visitedCount: 2,
    isCurrent: true
  }
];

describe('ReaderStage', () => {
  it('renders consecutive scene blocks as a longform paper flow', () => {
    const { container } = render(ReaderStage, {
      props: {
        blocks,
        activity: [
          {
            id: 'activity-1',
            label: '动作结果',
            detail: '你暂时稳住了局面。',
            tone: 'accent'
          }
        ]
      }
    });

    expect(container.querySelector('.reader-stage')).toHaveAttribute('data-flow', 'longform');
    expect(container.querySelectorAll('.scene-block')).toHaveLength(2);
    expect(container.querySelector('.scene-block[data-current="true"] h2')).toHaveTextContent('第二幕');
    expect(container.querySelector('.paper-sheet > article.scene-block + article.scene-block')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '北门之夜' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '第二幕' })).toBeInTheDocument();
    expect(screen.getByText('林冲')).toBeInTheDocument();
    expect(screen.getByText('午夜禁令')).toBeInTheDocument();
    expect(screen.getByText('你暂时稳住了局面。')).toBeInTheDocument();

    const activityRegion = screen.getByRole('region', { name: '最近动作结果' });
    expect(within(activityRegion).getByRole('list')).toBeInTheDocument();
    expect(within(activityRegion).getAllByRole('listitem')).toHaveLength(1);
    expect(container.querySelector('.activity-feed .tone-accent')).toHaveTextContent('动作结果');
  });
});
