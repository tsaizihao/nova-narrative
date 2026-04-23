import type { LoreLifecycleState, RulePriority, WorldBookInsertionMode } from '$lib/types';

export function ruleBadgeTone(priority: RulePriority | string): 'danger' | 'warning' | 'accent' | 'muted' {
  if (priority === 'hard_constraint') return 'danger';
  if (priority === 'soft_constraint') return 'warning';
  if (priority === 'consequence') return 'accent';
  return 'muted';
}

export function rulePriorityLabel(priority: RulePriority | string): string {
  if (priority === 'hard_constraint') return '硬约束';
  if (priority === 'soft_constraint') return '软约束';
  if (priority === 'consequence') return '结果推进';
  return '叙事门槛';
}

export function summarizePossibilityFlags(flags: string[]): string[] {
  return flags.map((flag) => flag.replace('possibility.', ''));
}

export function loreSlotLabel(slot: WorldBookInsertionMode | string): string {
  if (slot === 'scene_prelude') return '场景前奏';
  if (slot === 'rules_guard') return '规则守卫';
  return '阅读侧栏';
}

export function loreSourceLabel(source: string): string {
  if (source === 'character_card') return '角色卡';
  if (source === 'extractor') return '导入提炼';
  return source.replaceAll('_', ' ');
}

export function loreLifecycleTone(
  state: LoreLifecycleState | string
): 'accent' | 'warning' | 'muted' | 'success' {
  if (state === 'sticky') return 'accent';
  if (state === 'delayed') return 'warning';
  if (state === 'cooling_down') return 'muted';
  return 'success';
}
