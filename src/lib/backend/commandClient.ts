import { invoke } from '@tauri-apps/api/core';

import { mockBackend } from '$lib/mock-backend';

export interface CommandErrorPayload {
  code?: string;
  message: string;
  details?: unknown;
}

export class CommandClientError extends Error {
  code?: string;
  details?: unknown;

  constructor(payload: CommandErrorPayload) {
    super(payload.message);
    this.name = 'CommandClientError';
    this.code = payload.code;
    this.details = payload.details;
  }
}

const readStringField = (value: unknown, key: string): string | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
};

export const normalizeCommandError = (error: unknown): CommandClientError => {
  if (error instanceof CommandClientError) {
    return error;
  }

  if (error instanceof Error) {
    return new CommandClientError({ message: error.message });
  }

  const message =
    readStringField(error, 'message') ??
    readStringField(error, 'error') ??
    String(error);
  const code = readStringField(error, 'code');

  return new CommandClientError({
    code,
    message,
    details: error
  });
};

export interface CommandClientOptions {
  invokeImpl: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
  mockHandler: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
  isTauri: () => boolean;
}

export const createCommandClient = (options: CommandClientOptions) => ({
  async invokeCommand<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
    try {
      if (options.isTauri()) {
        return await options.invokeImpl<T>(command, payload);
      }
      return await options.mockHandler<T>(command, payload);
    } catch (error) {
      throw normalizeCommandError(error);
    }
  }
});

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const defaultMockHandler = async <T>(
  command: string,
  payload?: Record<string, unknown>
): Promise<T> => {
  const handlers: Record<string, () => Promise<unknown>> = {
    get_ai_settings: () => mockBackend.get_ai_settings(),
    save_ai_settings: () => mockBackend.save_ai_settings(payload?.input as never),
    clear_provider_api_key: () => mockBackend.clear_provider_api_key(payload?.providerKind as never),
    create_project: () => mockBackend.create_project(payload?.name as string),
    list_projects: () => mockBackend.list_projects(),
    list_saved_projects: () => mockBackend.list_saved_projects(),
    import_novel_text: () =>
      mockBackend.import_novel_text(payload?.projectId as string, payload?.content as string),
    build_story_package: () => mockBackend.build_story_package(payload?.projectId as string),
    get_build_status: () => mockBackend.get_build_status(payload?.projectId as string),
    load_story_package: () => mockBackend.load_story_package(payload?.projectId as string),
    get_project: () => mockBackend.get_project(payload?.projectId as string),
    start_session: () => mockBackend.start_session(payload?.projectId as string),
    get_current_scene: () => mockBackend.get_current_scene(payload?.sessionId as string),
    get_runtime_snapshot: () => mockBackend.get_runtime_snapshot(payload?.sessionId as string),
    submit_choice: () =>
      mockBackend.submit_choice(payload?.sessionId as string, payload?.choiceId as string),
    submit_free_input: () =>
      mockBackend.submit_free_input(payload?.sessionId as string, payload?.text as string),
    get_story_codex: () => mockBackend.get_story_codex(payload?.sessionId as string),
    update_character_card: () =>
      mockBackend.update_character_card(payload?.projectId as string, payload?.card as never),
    upsert_worldbook_entry: () =>
      mockBackend.upsert_worldbook_entry(payload?.projectId as string, payload?.entry as never),
    delete_worldbook_entry: () =>
      mockBackend.delete_worldbook_entry(payload?.projectId as string, payload?.entryId as string),
    upsert_rule: () => mockBackend.upsert_rule(payload?.projectId as string, payload?.rule as never),
    delete_rule: () => mockBackend.delete_rule(payload?.projectId as string, payload?.ruleId as string),
    preview_active_worldbook: () =>
      mockBackend.preview_active_worldbook(
        payload?.projectId as string,
        payload?.sceneId as string,
        payload?.lastFreeInput as string | undefined
      ),
    preview_rule_evaluation: () =>
      mockBackend.preview_rule_evaluation(
        payload?.projectId as string,
        payload?.sceneId as string,
        payload?.eventKind as string,
        payload?.actorCharacterId as string | undefined,
        payload?.targetCharacterId as string | undefined,
        payload?.inputText as string | undefined
      ),
    preview_review_snapshot: () =>
      mockBackend.preview_review_snapshot(payload?.projectId as string, payload?.context as never),
    save_review_preview_context: () =>
      mockBackend.save_review_preview_context(
        payload?.projectId as string,
        payload?.context as never
      ),
    rewind_to_checkpoint: () =>
      mockBackend.rewind_to_checkpoint(
        payload?.sessionId as string,
        payload?.checkpointId as string
      ),
    finish_session: () => mockBackend.finish_session(payload?.sessionId as string)
  };

  const handler = handlers[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }

  return (await handler()) as T;
};

const defaultClient = createCommandClient({
  invokeImpl: invoke,
  mockHandler: defaultMockHandler,
  isTauri
});

export const invokeCommand = defaultClient.invokeCommand;
