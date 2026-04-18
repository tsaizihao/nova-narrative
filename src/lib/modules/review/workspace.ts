import { get, writable, type Readable } from 'svelte/store';

import * as reviewBackend from './backend';
import type {
  CharacterCard,
  NovelProject,
  ReviewPreviewContext,
  ReviewPreviewSnapshot,
  RuleDefinition,
  WorldBookEntry
} from '$lib/types';
import type { ReviewSectionId } from '$lib/ui-layout';

export type ReviewPreviewStatus = 'stale' | 'refreshing' | 'ready' | 'error';

export interface ReviewWorkspaceState {
  project: NovelProject;
  activeSection: ReviewSectionId;
  activeSelection: Record<ReviewSectionId, string | null>;
  drafts: {
    characters: Record<string, CharacterCard>;
    worldbook: Record<string, WorldBookEntry>;
    rules: Record<string, RuleDefinition>;
  };
  dirty: {
    characters: Record<string, boolean>;
    worldbook: Record<string, boolean>;
    rules: Record<string, boolean>;
  };
  saveBusySection: ReviewSectionId | null;
  deleteBusySection: ReviewSectionId | null;
  error: string;
  preview: {
    previewContextDraft: ReviewPreviewContext | null;
    appliedPreviewContext: ReviewPreviewContext | null;
    previewSnapshot: ReviewPreviewSnapshot | null;
    previewStatus: ReviewPreviewStatus;
    previewError: string;
    requestVersion: number;
    status?: ReviewPreviewStatus;
  };
}

export interface ReviewWorkspaceBackend {
  updateCharacterCard(projectId: string, card: CharacterCard): Promise<CharacterCard[]>;
  upsertWorldBookEntry(projectId: string, entry: WorldBookEntry): Promise<WorldBookEntry[]>;
  deleteWorldBookEntry(projectId: string, entryId: string): Promise<WorldBookEntry[]>;
  upsertRule(projectId: string, rule: RuleDefinition): Promise<RuleDefinition[]>;
  deleteRule(projectId: string, ruleId: string): Promise<RuleDefinition[]>;
  previewReviewSnapshot(
    projectId: string,
    context: ReviewPreviewContext
  ): Promise<ReviewPreviewSnapshot>;
  saveReviewPreviewContext(
    projectId: string,
    context: ReviewPreviewContext
  ): Promise<ReviewPreviewContext>;
}

export interface ReviewWorkspaceController extends Readable<ReviewWorkspaceState> {
  setActiveSection(section: ReviewSectionId): void;
  selectCharacter(id: string): void;
  selectWorldBookEntry(id: string): void;
  selectRule(id: string): void;
  updateCharacterDraft(draft: CharacterCard): void;
  updateWorldBookDraft(draft: WorldBookEntry): void;
  updateRuleDraft(draft: RuleDefinition): void;
  updatePreviewContext(patch: Partial<ReviewPreviewContext>): void;
  saveCharacter(): Promise<void>;
  saveWorldBook(): Promise<void>;
  deleteWorldBook(): Promise<void>;
  saveRule(): Promise<void>;
  deleteRule(): Promise<void>;
  refreshPreview(): Promise<void>;
}

const DEFAULT_RULE_SAMPLE_INPUT = '午夜去开门';
const DEFAULT_RULE_EVENT_KIND = 'open_gate';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function toDraftMap<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, clone(item)]));
}

function toDirtyMap<T extends { id: string }>(items: T[]): Record<string, boolean> {
  return Object.fromEntries(items.map((item) => [item.id, false]));
}

function firstId<T extends { id: string }>(items: T[]): string | null {
  return items[0]?.id ?? null;
}

function firstDifferentId<T extends { id: string }>(items: T[], excludedId?: string | null): string | null {
  return items.find((item) => item.id !== excludedId)?.id ?? null;
}

function selectionForItems<T extends { id: string }>(
  currentSelection: string | null,
  items: T[],
  preferredId?: string | null
): string | null {
  if (preferredId && items.some((item) => item.id === preferredId)) {
    return preferredId;
  }
  if (currentSelection && items.some((item) => item.id === currentSelection)) {
    return currentSelection;
  }
  return firstId(items);
}

function reconcileDraftMap<T extends { id: string }>(
  items: T[],
  existingDrafts: Record<string, T>,
  dirtyMap: Record<string, boolean>,
  savedId?: string | null
): { drafts: Record<string, T>; dirty: Record<string, boolean> } {
  const drafts: Record<string, T> = {};
  const dirty: Record<string, boolean> = {};

  for (const item of items) {
    const hasUnsavedDraft = dirtyMap[item.id] && item.id !== savedId;
    drafts[item.id] = hasUnsavedDraft ? existingDrafts[item.id] : clone(item);
    dirty[item.id] = hasUnsavedDraft;
  }

  return { drafts, dirty };
}

function normalizePreviewContext(
  project: NovelProject,
  context: Partial<ReviewPreviewContext> | null | undefined
): ReviewPreviewContext | null {
  const packageScenes = project.story_package?.scenes;
  const startSceneId = project.story_package?.start_scene_id;
  if (!packageScenes || !startSceneId) {
    return null;
  }

  const availableSceneId =
    context?.sceneId && packageScenes[context.sceneId] ? context.sceneId : startSceneId;
  const actorCharacterId =
    context?.actorCharacterId && project.character_cards.some((card) => card.id === context.actorCharacterId)
      ? context.actorCharacterId
      : firstId(project.character_cards);
  const targetCharacterId =
    context?.targetCharacterId && project.character_cards.some((card) => card.id === context.targetCharacterId)
      ? context.targetCharacterId
      : firstDifferentId(project.character_cards, actorCharacterId);

  return {
    sceneId: availableSceneId,
    eventKind: context?.eventKind?.trim() || DEFAULT_RULE_EVENT_KIND,
    inputText: context?.inputText ?? DEFAULT_RULE_SAMPLE_INPUT,
    actorCharacterId: actorCharacterId ?? null,
    targetCharacterId: targetCharacterId ?? null
  };
}

function createInitialState(project: NovelProject): ReviewWorkspaceState {
  return {
    project: clone(project),
    activeSection: 'characters',
    activeSelection: {
      canon: null,
      characters: firstId(project.character_cards),
      worldbook: firstId(project.worldbook_entries),
      rules: firstId(project.rules)
    },
    drafts: {
      characters: toDraftMap(project.character_cards),
      worldbook: toDraftMap(project.worldbook_entries),
      rules: toDraftMap(project.rules)
    },
    dirty: {
      characters: toDirtyMap(project.character_cards),
      worldbook: toDirtyMap(project.worldbook_entries),
      rules: toDirtyMap(project.rules)
    },
    saveBusySection: null,
    deleteBusySection: null,
    error: '',
    preview: {
      previewContextDraft: normalizePreviewContext(project, project.review_preview_context),
      appliedPreviewContext: normalizePreviewContext(project, project.review_preview_context),
      previewSnapshot: null,
      previewStatus: 'stale',
      previewError: '',
      requestVersion: 0,
      status: 'stale'
    }
  };
}

function markPreviewStale(state: ReviewWorkspaceState, requestVersion: number): ReviewWorkspaceState {
  return {
    ...state,
    preview: {
      ...state.preview,
      previewStatus: 'stale',
      previewError: '',
      requestVersion,
      status: 'stale'
    }
  };
}

export function createReviewWorkspaceController(
  project: NovelProject,
  deps: ReviewWorkspaceBackend = reviewBackend
): ReviewWorkspaceController {
  const state = writable<ReviewWorkspaceState>(createInitialState(project));
  let latestPreviewRequestVersion = 0;

  const setActiveSection = (section: ReviewSectionId) => {
    state.update((current) => ({
      ...current,
      activeSection: section
    }));
  };

  const selectCharacter = (id: string) => {
    state.update((current) => ({
      ...current,
      activeSelection: {
        ...current.activeSelection,
        characters: id
      }
    }));
  };

  const selectWorldBookEntry = (id: string) => {
    state.update((current) => ({
      ...current,
      activeSelection: {
        ...current.activeSelection,
        worldbook: id
      }
    }));
  };

  const selectRule = (id: string) => {
    state.update((current) => ({
      ...current,
      activeSelection: {
        ...current.activeSelection,
        rules: id
      }
    }));
  };

  const updateCharacterDraft = (draft: CharacterCard) => {
    state.update((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        characters: {
          ...current.drafts.characters,
          [draft.id]: clone(draft)
        }
      },
      dirty: {
        ...current.dirty,
        characters: {
          ...current.dirty.characters,
          [draft.id]: true
        }
      },
      error: ''
    }));
  };

  const updateWorldBookDraft = (draft: WorldBookEntry) => {
    state.update((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        worldbook: {
          ...current.drafts.worldbook,
          [draft.id]: clone(draft)
        }
      },
      dirty: {
        ...current.dirty,
        worldbook: {
          ...current.dirty.worldbook,
          [draft.id]: true
        }
      },
      error: ''
    }));
  };

  const updateRuleDraft = (draft: RuleDefinition) => {
    state.update((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        rules: {
          ...current.drafts.rules,
          [draft.id]: clone(draft)
        }
      },
      dirty: {
        ...current.dirty,
        rules: {
          ...current.dirty.rules,
          [draft.id]: true
        }
      },
      error: ''
    }));
  };

  const applyStalePreview = () => {
    latestPreviewRequestVersion += 1;
    state.update((current) => markPreviewStale(current, latestPreviewRequestVersion));
  };

  const runPreviewRefresh = async (contextOverride?: ReviewPreviewContext | null) => {
    const current = get(state);
    const nextContext = normalizePreviewContext(
      current.project,
      contextOverride ?? current.preview.previewContextDraft
    );

    if (!nextContext) {
      latestPreviewRequestVersion += 1;
      state.update((value) => ({
        ...value,
        preview: {
          ...value.preview,
          previewContextDraft: null,
          previewStatus: 'error',
          previewError: '当前项目还没有可预览的起始场景',
          requestVersion: latestPreviewRequestVersion,
          status: 'error'
        }
      }));
      return;
    }

    const requestVersion = latestPreviewRequestVersion + 1;
    latestPreviewRequestVersion = requestVersion;

    state.update((value) => ({
      ...value,
      preview: {
        ...value.preview,
        previewContextDraft: clone(nextContext),
        previewStatus: 'refreshing',
        previewError: '',
        requestVersion,
        status: 'refreshing'
      }
    }));

    try {
      const snapshot = await deps.previewReviewSnapshot(current.project.id, clone(nextContext));
      if (requestVersion !== latestPreviewRequestVersion) {
        return;
      }

      state.update((value) => ({
        ...value,
        project: {
          ...value.project,
          review_preview_context: clone(snapshot.context)
        },
        preview: {
          ...value.preview,
          previewContextDraft: clone(nextContext),
          appliedPreviewContext: clone(snapshot.context),
          previewSnapshot: clone(snapshot),
          previewStatus: 'ready',
          previewError: '',
          requestVersion,
          status: 'ready'
        }
      }));

      void deps
        .saveReviewPreviewContext(current.project.id, clone(snapshot.context))
        .then((persistedContext) => {
          if (requestVersion !== latestPreviewRequestVersion) {
            return;
          }

          state.update((value) => ({
            ...value,
            project: {
              ...value.project,
              review_preview_context: clone(persistedContext)
            }
          }));
        })
        .catch((error) => {
          if (requestVersion !== latestPreviewRequestVersion) {
            return;
          }

          state.update((value) => ({
            ...value,
            preview: {
              ...value.preview,
              previewError: normalizeError(error, '保存预览上下文失败')
            }
          }));
        });
    } catch (error) {
      if (requestVersion !== latestPreviewRequestVersion) {
        return;
      }

      state.update((value) => ({
        ...value,
        preview: {
          ...value.preview,
          previewContextDraft: clone(nextContext),
          previewStatus: 'error',
          previewError: normalizeError(error, '刷新预览失败'),
          requestVersion,
          status: 'error'
        }
      }));
    }
  };

  const updatePreviewContext = (patch: Partial<ReviewPreviewContext>) => {
    const current = get(state);
    const mergedContext = normalizePreviewContext(current.project, {
      ...(current.preview.previewContextDraft ?? {}),
      ...patch
    });

    state.update((value) => ({
      ...value,
      preview: {
        ...value.preview,
        previewContextDraft: mergedContext ? clone(mergedContext) : null
      }
    }));

    void runPreviewRefresh(mergedContext);
  };

  const saveCharacter = async () => {
    const current = get(state);
    const id = current.activeSelection.characters;
    if (!id) return;
    const draft = current.drafts.characters[id];
    if (!draft) return;

    state.update((value) => ({
      ...value,
      saveBusySection: 'characters',
      error: ''
    }));

    try {
      const cards = await deps.updateCharacterCard(current.project.id, clone(draft));
      latestPreviewRequestVersion += 1;
      state.update((value) => {
        const reconciled = reconcileDraftMap(cards, value.drafts.characters, value.dirty.characters, id);
        return markPreviewStale(
          {
            ...value,
            project: {
              ...value.project,
              character_cards: cards
            },
            activeSelection: {
              ...value.activeSelection,
              characters: selectionForItems(value.activeSelection.characters, cards, id)
            },
            drafts: {
              ...value.drafts,
              characters: reconciled.drafts
            },
            dirty: {
              ...value.dirty,
              characters: reconciled.dirty
            },
            saveBusySection: null
          },
          latestPreviewRequestVersion
        );
      });
    } catch (error) {
      state.update((value) => ({
        ...value,
        saveBusySection: null,
        error: normalizeError(error, '保存角色失败')
      }));
    }
  };

  const saveWorldBook = async () => {
    const current = get(state);
    const id = current.activeSelection.worldbook;
    if (!id) return;
    const draft = current.drafts.worldbook[id];
    if (!draft) return;

    state.update((value) => ({
      ...value,
      saveBusySection: 'worldbook',
      error: ''
    }));

    try {
      const entries = await deps.upsertWorldBookEntry(current.project.id, clone(draft));
      latestPreviewRequestVersion += 1;
      state.update((value) => {
        const reconciled = reconcileDraftMap(entries, value.drafts.worldbook, value.dirty.worldbook, id);
        return markPreviewStale(
          {
            ...value,
            project: {
              ...value.project,
              worldbook_entries: entries
            },
            activeSelection: {
              ...value.activeSelection,
              worldbook: selectionForItems(value.activeSelection.worldbook, entries, id)
            },
            drafts: {
              ...value.drafts,
              worldbook: reconciled.drafts
            },
            dirty: {
              ...value.dirty,
              worldbook: reconciled.dirty
            },
            saveBusySection: null
          },
          latestPreviewRequestVersion
        );
      });
    } catch (error) {
      state.update((value) => ({
        ...value,
        saveBusySection: null,
        error: normalizeError(error, '保存世界书失败')
      }));
    }
  };

  const deleteWorldBook = async () => {
    const current = get(state);
    const id = current.activeSelection.worldbook;
    if (!id) return;

    state.update((value) => ({
      ...value,
      deleteBusySection: 'worldbook',
      error: ''
    }));

    try {
      const entries = await deps.deleteWorldBookEntry(current.project.id, id);
      latestPreviewRequestVersion += 1;
      state.update((value) => {
        const reconciled = reconcileDraftMap(entries, value.drafts.worldbook, value.dirty.worldbook, null);
        return markPreviewStale(
          {
            ...value,
            project: {
              ...value.project,
              worldbook_entries: entries
            },
            activeSelection: {
              ...value.activeSelection,
              worldbook: selectionForItems(value.activeSelection.worldbook, entries)
            },
            drafts: {
              ...value.drafts,
              worldbook: reconciled.drafts
            },
            dirty: {
              ...value.dirty,
              worldbook: reconciled.dirty
            },
            deleteBusySection: null
          },
          latestPreviewRequestVersion
        );
      });
    } catch (error) {
      state.update((value) => ({
        ...value,
        deleteBusySection: null,
        error: normalizeError(error, '删除世界书失败')
      }));
    }
  };

  const saveRule = async () => {
    const current = get(state);
    const id = current.activeSelection.rules;
    if (!id) return;
    const draft = current.drafts.rules[id];
    if (!draft) return;

    state.update((value) => ({
      ...value,
      saveBusySection: 'rules',
      error: ''
    }));

    try {
      const rules = await deps.upsertRule(current.project.id, clone(draft));
      latestPreviewRequestVersion += 1;
      state.update((value) => {
        const reconciled = reconcileDraftMap(rules, value.drafts.rules, value.dirty.rules, id);
        return markPreviewStale(
          {
            ...value,
            project: {
              ...value.project,
              rules
            },
            activeSelection: {
              ...value.activeSelection,
              rules: selectionForItems(value.activeSelection.rules, rules, id)
            },
            drafts: {
              ...value.drafts,
              rules: reconciled.drafts
            },
            dirty: {
              ...value.dirty,
              rules: reconciled.dirty
            },
            saveBusySection: null
          },
          latestPreviewRequestVersion
        );
      });
    } catch (error) {
      state.update((value) => ({
        ...value,
        saveBusySection: null,
        error: normalizeError(error, '保存规则失败')
      }));
    }
  };

  const deleteRule = async () => {
    const current = get(state);
    const id = current.activeSelection.rules;
    if (!id) return;

    state.update((value) => ({
      ...value,
      deleteBusySection: 'rules',
      error: ''
    }));

    try {
      const rules = await deps.deleteRule(current.project.id, id);
      latestPreviewRequestVersion += 1;
      state.update((value) => {
        const reconciled = reconcileDraftMap(rules, value.drafts.rules, value.dirty.rules, null);
        return markPreviewStale(
          {
            ...value,
            project: {
              ...value.project,
              rules
            },
            activeSelection: {
              ...value.activeSelection,
              rules: selectionForItems(value.activeSelection.rules, rules)
            },
            drafts: {
              ...value.drafts,
              rules: reconciled.drafts
            },
            dirty: {
              ...value.dirty,
              rules: reconciled.dirty
            },
            deleteBusySection: null
          },
          latestPreviewRequestVersion
        );
      });
    } catch (error) {
      state.update((value) => ({
        ...value,
        deleteBusySection: null,
        error: normalizeError(error, '删除规则失败')
      }));
    }
  };

  const refreshPreview = async () => {
    await runPreviewRefresh();
  };

  const initialContext = get(state).preview.previewContextDraft;
  if (initialContext) {
    void Promise.resolve().then(() => {
      if (latestPreviewRequestVersion !== 0) {
        return;
      }
      void runPreviewRefresh(initialContext);
    });
  }

  return {
    subscribe: state.subscribe,
    setActiveSection,
    selectCharacter,
    selectWorldBookEntry,
    selectRule,
    updateCharacterDraft,
    updateWorldBookDraft,
    updateRuleDraft,
    updatePreviewContext,
    saveCharacter,
    saveWorldBook,
    deleteWorldBook,
    saveRule,
    deleteRule,
    refreshPreview
  };
}
