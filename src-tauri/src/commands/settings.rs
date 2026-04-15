use tauri::State;

use crate::{
    StoreState,
    application::SettingsService,
    commands::shared::{CommandResult, with_store},
    models::{AiProviderKind, AppAiSettingsSnapshot, SaveAiSettingsInput},
};

#[tauri::command]
pub fn get_ai_settings(state: State<'_, StoreState>) -> CommandResult<AppAiSettingsSnapshot> {
    with_store(state, SettingsService::get_ai_settings)
}

#[tauri::command]
pub fn save_ai_settings(
    state: State<'_, StoreState>,
    input: SaveAiSettingsInput,
) -> CommandResult<AppAiSettingsSnapshot> {
    with_store(state, move |store| SettingsService::save_ai_settings(store, input))
}

#[tauri::command]
pub fn clear_provider_api_key(
    state: State<'_, StoreState>,
    provider_kind: AiProviderKind,
) -> CommandResult<AppAiSettingsSnapshot> {
    with_store(state, move |store| {
        SettingsService::clear_provider_api_key(store, provider_kind)
    })
}
