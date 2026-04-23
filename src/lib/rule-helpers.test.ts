import { describe, expect, it } from 'vitest';

import {
  loreLifecycleTone,
  loreSourceLabel,
  loreSlotLabel,
  ruleBadgeTone,
  rulePriorityLabel,
  summarizePossibilityFlags
} from '$lib/rule-helpers';

describe('rule-helpers', () => {
  it('maps hard constraints to danger styling', () => {
    expect(ruleBadgeTone('hard_constraint')).toBe('danger');
  });

  it('summarizes possibility flags for the state panel', () => {
    expect(summarizePossibilityFlags(['possibility.conception=false'])).toEqual([
      'conception=false'
    ]);
  });

  it('maps lore slots to readable labels', () => {
    expect(loreSlotLabel('rules_guard')).toBe('规则守卫');
  });

  it('keeps delayed lore visually distinct', () => {
    expect(loreLifecycleTone('delayed')).toBe('warning');
  });

  it('maps source and priority keys to readable archive labels', () => {
    expect(loreSourceLabel('character_card')).toBe('角色卡');
    expect(loreSourceLabel('extractor')).toBe('导入提炼');
    expect(rulePriorityLabel('hard_constraint')).toBe('硬约束');
    expect(rulePriorityLabel('narrative_gate')).toBe('叙事门槛');
  });

  it('uses explicit fallback paths for unknown source and priority labels', () => {
    expect(loreSourceLabel('custom_archive_source')).toBe('custom archive source');
    expect(rulePriorityLabel('unknown_priority')).toBe('未分类');
  });
});
