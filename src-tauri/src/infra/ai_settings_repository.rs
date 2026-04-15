use std::fs;

use crate::{
    error::AppResult,
    models::{
        AiProviderKind, AppAiSettingsSnapshot, ExternalProviderSettingsInput,
        ExternalProviderSettingsSnapshot, SaveAiSettingsInput,
    },
    provider::SecretStore,
};

use super::RuntimeDataPaths;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PersistedExternalProviderSettings {
    pub base_url: String,
    pub model: String,
}

impl Default for PersistedExternalProviderSettings {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            model: String::new(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PersistedAiSettings {
    pub selected_provider: AiProviderKind,
    pub openai_compatible: PersistedExternalProviderSettings,
    pub openrouter: PersistedExternalProviderSettings,
}

impl Default for PersistedAiSettings {
    fn default() -> Self {
        Self {
            selected_provider: AiProviderKind::Heuristic,
            openai_compatible: PersistedExternalProviderSettings::default(),
            openrouter: PersistedExternalProviderSettings {
                base_url: "https://openrouter.ai/api/v1".into(),
                model: String::new(),
            },
        }
    }
}

impl PersistedAiSettings {
    pub fn to_snapshot(&self, secret_store: &dyn SecretStore) -> AppResult<AppAiSettingsSnapshot> {
        Ok(AppAiSettingsSnapshot {
            selected_provider: self.selected_provider.clone(),
            openai_compatible: ExternalProviderSettingsSnapshot {
                base_url: self.openai_compatible.base_url.clone(),
                model: self.openai_compatible.model.clone(),
                has_api_key: secret_store
                    .get_api_key(AiProviderKind::OpenAiCompatible)?
                    .is_some(),
            },
            openrouter: ExternalProviderSettingsSnapshot {
                base_url: self.openrouter.base_url.clone(),
                model: self.openrouter.model.clone(),
                has_api_key: secret_store.get_api_key(AiProviderKind::OpenRouter)?.is_some(),
            },
        })
    }

    pub fn apply_save(
        &mut self,
        input: &SaveAiSettingsInput,
        secret_store: &dyn SecretStore,
    ) -> AppResult<()> {
        self.selected_provider = input.selected_provider.clone();
        self.openai_compatible = normalize_external_settings(&input.openai_compatible);
        self.openrouter = normalize_external_settings(&input.openrouter);

        maybe_store_api_key(
            secret_store,
            AiProviderKind::OpenAiCompatible,
            input.openai_compatible.api_key.as_deref(),
        )?;
        maybe_store_api_key(
            secret_store,
            AiProviderKind::OpenRouter,
            input.openrouter.api_key.as_deref(),
        )?;

        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct AiSettingsRepository {
    layout: RuntimeDataPaths,
}

impl AiSettingsRepository {
    pub fn new(layout: RuntimeDataPaths) -> AppResult<Self> {
        layout.ensure_layout()?;
        Ok(Self { layout })
    }

    pub fn load_or_default(&self) -> AppResult<PersistedAiSettings> {
        let path = self.layout.ai_settings_path();
        if path.exists() {
            Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
        } else {
            Ok(PersistedAiSettings::default())
        }
    }

    pub fn save(&self, settings: &PersistedAiSettings) -> AppResult<()> {
        let content = serde_json::to_string_pretty(settings)?;
        fs::write(self.layout.ai_settings_path(), content)?;
        Ok(())
    }
}

fn normalize_external_settings(input: &ExternalProviderSettingsInput) -> PersistedExternalProviderSettings {
    PersistedExternalProviderSettings {
        base_url: normalize_base_url(&input.base_url),
        model: input.model.trim().to_string(),
    }
}

fn normalize_base_url(raw: &str) -> String {
    raw.trim().trim_end_matches('/').to_string()
}

fn maybe_store_api_key(
    secret_store: &dyn SecretStore,
    provider: AiProviderKind,
    api_key: Option<&str>,
) -> AppResult<()> {
    if let Some(api_key) = api_key.map(str::trim).filter(|value| !value.is_empty()) {
        secret_store.set_api_key(provider, api_key)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::{infra::RuntimeDataPaths, models::AiProviderKind};

    use super::{AiSettingsRepository, PersistedAiSettings, PersistedExternalProviderSettings};

    #[test]
    fn round_trips_non_secret_ai_settings_without_writing_api_keys() {
        let dir = tempdir().expect("temp dir");
        let layout = RuntimeDataPaths::new(dir.path().to_path_buf());
        let repository = AiSettingsRepository::new(layout.clone()).expect("repo");
        let settings = PersistedAiSettings {
            selected_provider: AiProviderKind::OpenAiCompatible,
            openai_compatible: PersistedExternalProviderSettings {
                base_url: "https://example.com/v1".into(),
                model: "gpt-4o-mini".into(),
            },
            openrouter: PersistedExternalProviderSettings {
                base_url: "https://openrouter.ai/api/v1".into(),
                model: "openai/gpt-4o-mini".into(),
            },
        };

        repository.save(&settings).expect("save");

        let raw = std::fs::read_to_string(layout.ai_settings_path()).expect("raw");
        assert!(raw.contains("gpt-4o-mini"));
        assert!(!raw.contains("sk-"));

        let reloaded = repository.load_or_default().expect("reload");
        assert_eq!(reloaded.selected_provider, AiProviderKind::OpenAiCompatible);
        assert_eq!(reloaded.openai_compatible.base_url, "https://example.com/v1");
    }
}
