export interface ImportDraftSnapshot {
  projectName: string;
  novelText: string;
  settingsPrompt: string | null;
}

const STORAGE_KEY = 'nova.import-draft';

const EMPTY_DRAFT: ImportDraftSnapshot = {
  projectName: '',
  novelText: '',
  settingsPrompt: null
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadImportDraft(): ImportDraftSnapshot {
  if (!canUseStorage()) return { ...EMPTY_DRAFT };

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...EMPTY_DRAFT };

  try {
    const parsed = JSON.parse(raw) as Partial<ImportDraftSnapshot>;
    return {
      projectName: parsed.projectName ?? '',
      novelText: parsed.novelText ?? '',
      settingsPrompt: typeof parsed.settingsPrompt === 'string' ? parsed.settingsPrompt : null
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveImportDraft(snapshot: ImportDraftSnapshot) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearImportDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
