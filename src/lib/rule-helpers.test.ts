import { describe, expect, it } from 'vitest';

import {
  loreLifecycleTone,
  loreSlotLabel,
  ruleBadgeTone,
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
});
