import { describe, expect, it } from 'vitest';

import { formatRelativeActivityTime } from './library';

describe('project library formatting', () => {
  const now = new Date('2026-04-16T12:00:00+08:00').getTime();

  it('formats relative activity time across the supported buckets', () => {
    expect(formatRelativeActivityTime(now - 20_000, now)).toBe('刚刚');
    expect(formatRelativeActivityTime(now - 15 * 60_000, now)).toBe('15 分钟前');
    expect(formatRelativeActivityTime(now - 3 * 60 * 60_000, now)).toBe('3 小时前');
    expect(formatRelativeActivityTime(new Date('2026-04-15T20:00:00+08:00').getTime(), now)).toBe('昨天');
    expect(formatRelativeActivityTime(new Date('2026-04-12T12:00:00+08:00').getTime(), now)).toBe('4 天前');
    expect(formatRelativeActivityTime(new Date('2026-04-01T12:00:00+08:00').getTime(), now)).toBe('2026-04-01');
  });
});
