import { invoke } from '@tauri-apps/api/core';

import { mockBackend } from '$lib/mock-backend';
import type {
  ActiveLoreEntry,
  BuildStatus,
  EndingReport,
  NovelProject,
  RuleDefinition,
  RuleEvaluationResult,
  ScenePayload,
  SessionState,
  StoryCodex,
  StoryPackage,
  WorldBookEntry,
  CharacterCard
} from '$lib/types';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function desktopInvoke<T>(command: string, args?: Record<string, unknown>) {
  if (isTauri()) {
    return invoke<T>(command, args);
  }

  switch (command) {
    case 'create_project':
      return mockBackend.create_project(args?.name as string) as Promise<T>;
    case 'import_novel_text':
      return mockBackend.import_novel_text(args?.projectId as string, args?.content as string) as Promise<T>;
    case 'build_story_package':
      return mockBackend.build_story_package(args?.projectId as string) as Promise<T>;
    case 'get_build_status':
      return mockBackend.get_build_status(args?.projectId as string) as Promise<T>;
    case 'load_story_package':
      return mockBackend.load_story_package(args?.projectId as string) as Promise<T>;
    case 'get_project':
      return mockBackend.get_project(args?.projectId as string) as Promise<T>;
    case 'start_session':
      return mockBackend.start_session(args?.projectId as string) as Promise<T>;
    case 'get_current_scene':
      return mockBackend.get_current_scene(args?.sessionId as string) as Promise<T>;
    case 'submit_choice':
      return mockBackend.submit_choice(args?.sessionId as string, args?.choiceId as string) as Promise<T>;
    case 'submit_free_input':
      return mockBackend.submit_free_input(args?.sessionId as string, args?.text as string) as Promise<T>;
    case 'get_story_codex':
      return mockBackend.get_story_codex(args?.sessionId as string) as Promise<T>;
    case 'update_character_card':
      return mockBackend.update_character_card(
        args?.projectId as string,
        args?.card as CharacterCard
      ) as Promise<T>;
    case 'upsert_worldbook_entry':
      return mockBackend.upsert_worldbook_entry(
        args?.projectId as string,
        args?.entry as WorldBookEntry
      ) as Promise<T>;
    case 'delete_worldbook_entry':
      return mockBackend.delete_worldbook_entry(
        args?.projectId as string,
        args?.entryId as string
      ) as Promise<T>;
    case 'upsert_rule':
      return mockBackend.upsert_rule(args?.projectId as string, args?.rule as RuleDefinition) as Promise<T>;
    case 'delete_rule':
      return mockBackend.delete_rule(args?.projectId as string, args?.ruleId as string) as Promise<T>;
    case 'preview_active_worldbook':
      return mockBackend.preview_active_worldbook(
        args?.projectId as string,
        args?.sceneId as string,
        args?.lastFreeInput as string | undefined
      ) as Promise<T>;
    case 'preview_rule_evaluation':
      return mockBackend.preview_rule_evaluation(
        args?.projectId as string,
        args?.sceneId as string,
        args?.eventKind as string,
        args?.actorCharacterId as string | undefined,
        args?.targetCharacterId as string | undefined,
        args?.inputText as string | undefined
      ) as Promise<T>;
    case 'rewind_to_checkpoint':
      return mockBackend.rewind_to_checkpoint(
        args?.sessionId as string,
        args?.checkpointId as string
      ) as Promise<T>;
    case 'finish_session':
      return mockBackend.finish_session(args?.sessionId as string) as Promise<T>;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

export const api = {
  createProject(name: string) {
    return desktopInvoke<NovelProject>('create_project', { name });
  },
  importNovelText(projectId: string, content: string) {
    return desktopInvoke<NovelProject>('import_novel_text', { projectId, content });
  },
  buildStoryPackage(projectId: string) {
    return desktopInvoke<BuildStatus>('build_story_package', { projectId });
  },
  getBuildStatus(projectId: string) {
    return desktopInvoke<BuildStatus>('get_build_status', { projectId });
  },
  loadStoryPackage(projectId: string) {
    return desktopInvoke<StoryPackage>('load_story_package', { projectId });
  },
  getProject(projectId: string) {
    return desktopInvoke<NovelProject>('get_project', { projectId });
  },
  startSession(projectId: string) {
    return desktopInvoke<SessionState>('start_session', { projectId });
  },
  getCurrentScene(sessionId: string) {
    return desktopInvoke<ScenePayload>('get_current_scene', { sessionId });
  },
  submitChoice(sessionId: string, choiceId: string) {
    return desktopInvoke<ScenePayload>('submit_choice', { sessionId, choiceId });
  },
  submitFreeInput(sessionId: string, text: string) {
    return desktopInvoke<ScenePayload>('submit_free_input', { sessionId, text });
  },
  getStoryCodex(sessionId: string) {
    return desktopInvoke<StoryCodex>('get_story_codex', { sessionId });
  },
  updateCharacterCard(projectId: string, card: CharacterCard) {
    return desktopInvoke<CharacterCard[]>('update_character_card', { projectId, card });
  },
  upsertWorldBookEntry(projectId: string, entry: WorldBookEntry) {
    return desktopInvoke<WorldBookEntry[]>('upsert_worldbook_entry', { projectId, entry });
  },
  deleteWorldBookEntry(projectId: string, entryId: string) {
    return desktopInvoke<WorldBookEntry[]>('delete_worldbook_entry', { projectId, entryId });
  },
  upsertRule(projectId: string, rule: RuleDefinition) {
    return desktopInvoke<RuleDefinition[]>('upsert_rule', { projectId, rule });
  },
  deleteRule(projectId: string, ruleId: string) {
    return desktopInvoke<RuleDefinition[]>('delete_rule', { projectId, ruleId });
  },
  previewActiveWorldbook(projectId: string, sceneId: string, lastFreeInput?: string) {
    return desktopInvoke<ActiveLoreEntry[]>('preview_active_worldbook', {
      projectId,
      sceneId,
      lastFreeInput
    });
  },
  previewRuleEvaluation(
    projectId: string,
    sceneId: string,
    eventKind: string,
    actorCharacterId?: string,
    targetCharacterId?: string,
    inputText?: string
  ) {
    return desktopInvoke<RuleEvaluationResult>('preview_rule_evaluation', {
      projectId,
      sceneId,
      eventKind,
      actorCharacterId,
      targetCharacterId,
      inputText
    });
  },
  rewindToCheckpoint(sessionId: string, checkpointId: string) {
    return desktopInvoke<ScenePayload>('rewind_to_checkpoint', { sessionId, checkpointId });
  },
  finishSession(sessionId: string) {
    return desktopInvoke<EndingReport | null>('finish_session', { sessionId });
  }
};
