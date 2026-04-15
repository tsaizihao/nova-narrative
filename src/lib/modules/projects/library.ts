import type {
  SavedProjectActivityKind,
  SavedProjectLibraryEntry
} from '$lib/types';

export interface SavedProjectCardEntry {
  project: SavedProjectLibraryEntry['project'];
  sessionId: string | null;
  activityKind?: SavedProjectActivityKind;
  activityLabel: string;
  activityMetaLabel?: string;
  activityTimeLabel: string;
  ctaLabel: string;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function startOfLocalDay(timestampMs: number) {
  const date = new Date(timestampMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDate(timestampMs: number) {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatRelativeActivityTime(timestampMs: number, nowMs = Date.now()) {
  const safeNow = Math.max(nowMs, timestampMs);
  const diffMs = safeNow - timestampMs;

  if (diffMs < MINUTE_MS) {
    return '刚刚';
  }

  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)} 分钟前`;
  }

  if (startOfLocalDay(timestampMs) === startOfLocalDay(safeNow)) {
    return `${Math.floor(diffMs / HOUR_MS)} 小时前`;
  }

  const dayDiff = Math.floor((startOfLocalDay(safeNow) - startOfLocalDay(timestampMs)) / DAY_MS);
  if (dayDiff === 1) {
    return '昨天';
  }

  if (dayDiff < 7) {
    return `${dayDiff} 天前`;
  }

  return formatDate(timestampMs);
}

export function toSavedProjectCardEntry(
  entry: SavedProjectLibraryEntry,
  nowMs = Date.now()
): SavedProjectCardEntry {
  const sessionId = entry.session_id ?? null;
  const activityTimeLabel = formatRelativeActivityTime(entry.last_activity_at, nowMs);

  if (entry.last_activity_kind === 'ending') {
    return {
      project: entry.project,
      sessionId,
      activityKind: entry.last_activity_kind,
      activityLabel: `已抵达结局：${entry.ending_type ?? '故事完结'}`,
      activityMetaLabel: '最近游玩',
      activityTimeLabel,
      ctaLabel: `查看结局${entry.project.name}`
    };
  }

  if (entry.last_activity_kind === 'session') {
    return {
      project: entry.project,
      sessionId,
      activityKind: entry.last_activity_kind,
      activityLabel: `上次停在：${entry.current_scene_title ?? '最近场景'}`,
      activityMetaLabel: '最近游玩',
      activityTimeLabel,
      ctaLabel: `继续互动${entry.project.name}`
    };
  }

  return {
    project: entry.project,
    sessionId,
    activityKind: entry.last_activity_kind,
    activityLabel: '尚未开始互动，可先进入审阅',
    activityMetaLabel: '最近导入',
    activityTimeLabel,
    ctaLabel: `进入审阅${entry.project.name}`
  };
}
