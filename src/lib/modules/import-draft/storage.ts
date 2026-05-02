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
  return getStorage() !== null;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadImportDraft(): ImportDraftSnapshot {
  const storage = getStorage();
  if (!storage) return { ...EMPTY_DRAFT };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ...EMPTY_DRAFT };
  }

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
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage write failures and keep the in-memory draft flow working.
  }
}

export function clearImportDraft() {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage delete failures and keep the in-memory draft flow working.
  }
}
