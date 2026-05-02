export type WorkspacePhase = 'import' | 'building' | 'review' | 'reader';

export interface WorkspaceContextSnapshot {
  phase: WorkspacePhase;
  projectId: string | null;
  projectName: string;
  sessionId: string | null;
}

const STORAGE_KEY = 'nova.workspace-context';

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

export function loadWorkspaceContext(): WorkspaceContextSnapshot | null {
  if (!canUseStorage()) return null;

  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceContextSnapshot>;
    if (
      parsed.phase !== 'import' &&
      parsed.phase !== 'building' &&
      parsed.phase !== 'review' &&
      parsed.phase !== 'reader'
    ) {
      return null;
    }

    return {
      phase: parsed.phase,
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : null,
      projectName: typeof parsed.projectName === 'string' ? parsed.projectName : '',
      sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceContext(snapshot: WorkspaceContextSnapshot) {
  if (!canUseStorage()) return;

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage write failures so navigation can continue.
  }
}

export function clearWorkspaceContext() {
  if (!canUseStorage()) return;

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage delete failures so navigation can continue.
  }
}
