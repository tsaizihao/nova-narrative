import { invokeCommand } from '$lib/backend/commandClient';
import type { AiProviderKind, AppAiSettingsSnapshot, SaveAiSettingsInput } from '$lib/types';

export const getAiSettings = (): Promise<AppAiSettingsSnapshot> => invokeCommand('get_ai_settings');

export const saveAiSettings = (input: SaveAiSettingsInput): Promise<AppAiSettingsSnapshot> =>
  invokeCommand('save_ai_settings', { input });

export const clearProviderApiKey = (
  providerKind: AiProviderKind
): Promise<AppAiSettingsSnapshot> => invokeCommand('clear_provider_api_key', { providerKind });
