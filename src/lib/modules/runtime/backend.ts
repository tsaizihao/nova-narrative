import { invokeCommand } from '$lib/backend/commandClient';
import type {
  EndingReport,
  RuntimeSnapshot,
  ScenePayload,
  SessionState,
  StoryCodex
} from '$lib/types';

export const startSession = (projectId: string): Promise<SessionState> =>
  invokeCommand('start_session', { projectId });

export const findProjectSession = (projectId: string): Promise<SessionState | null> =>
  invokeCommand('find_project_session', { projectId });

export const getCurrentScene = (sessionId: string): Promise<ScenePayload> =>
  invokeCommand('get_current_scene', { sessionId });

export const getRuntimeSnapshot = (sessionId: string): Promise<RuntimeSnapshot> =>
  invokeCommand('get_runtime_snapshot', { sessionId });

export const submitChoice = (sessionId: string, choiceId: string): Promise<ScenePayload> =>
  invokeCommand('submit_choice', { sessionId, choiceId });

export const submitFreeInput = (sessionId: string, text: string): Promise<ScenePayload> =>
  invokeCommand('submit_free_input', { sessionId, text });

export const getStoryCodex = (sessionId: string): Promise<StoryCodex> =>
  invokeCommand('get_story_codex', { sessionId });

export const rewindToCheckpoint = (
  sessionId: string,
  checkpointId: string
): Promise<ScenePayload> => invokeCommand('rewind_to_checkpoint', { sessionId, checkpointId });

export const finishSession = (sessionId: string): Promise<EndingReport | null> =>
  invokeCommand('finish_session', { sessionId });
