use crate::{
    error::AppResult,
    models::{AiProviderKind, AppAiSettingsSnapshot, SaveAiSettingsInput},
    store::ProjectStore,
};

pub struct SettingsService;

impl SettingsService {
    pub fn get_ai_settings(store: &mut ProjectStore) -> AppResult<AppAiSettingsSnapshot> {
        store.get_ai_settings()
    }

    pub fn save_ai_settings(
        store: &mut ProjectStore,
        input: SaveAiSettingsInput,
    ) -> AppResult<AppAiSettingsSnapshot> {
        store.save_ai_settings(input)
    }

    pub fn clear_provider_api_key(
        store: &mut ProjectStore,
        provider_kind: AiProviderKind,
    ) -> AppResult<AppAiSettingsSnapshot> {
        store.clear_provider_api_key(provider_kind)
    }
}
