use std::fs;

use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, AppResult},
    infra::RuntimeDataPaths,
};

pub const CURRENT_STORAGE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StorageManifest {
    pub version: u32,
}

impl Default for StorageManifest {
    fn default() -> Self {
        Self {
            version: CURRENT_STORAGE_VERSION,
        }
    }
}

#[derive(Debug, Clone)]
pub struct StorageManifestRepository {
    layout: RuntimeDataPaths,
}

impl StorageManifestRepository {
    pub fn new(layout: RuntimeDataPaths) -> AppResult<Self> {
        layout.ensure_layout()?;
        Ok(Self { layout })
    }

    pub fn bootstrap(&self) -> AppResult<StorageManifest> {
        let Some(existing) = self.load()? else {
            let manifest = StorageManifest::default();
            self.save(&manifest)?;
            return Ok(manifest);
        };

        let migrated = migrate_manifest(existing)?;
        self.save(&migrated)?;
        Ok(migrated)
    }

    pub fn load(&self) -> AppResult<Option<StorageManifest>> {
        let path = self.layout.storage_manifest_path();
        if !path.exists() {
            return Ok(None);
        }

        let raw = fs::read_to_string(path)?;
        Ok(Some(serde_json::from_str(&raw)?))
    }

    pub fn save(&self, manifest: &StorageManifest) -> AppResult<()> {
        let content = serde_json::to_string_pretty(manifest)?;
        fs::write(self.layout.storage_manifest_path(), content)?;
        Ok(())
    }
}

fn migrate_manifest(mut manifest: StorageManifest) -> AppResult<StorageManifest> {
    while manifest.version < CURRENT_STORAGE_VERSION {
        manifest = match manifest.version {
            0 => StorageManifest { version: 1 },
            unsupported => {
                return Err(AppError::InvalidState(format!(
                    "unsupported storage manifest version {unsupported}"
                )))
            }
        };
    }

    if manifest.version > CURRENT_STORAGE_VERSION {
        return Err(AppError::InvalidState(format!(
            "storage manifest version {} is newer than supported {}",
            manifest.version, CURRENT_STORAGE_VERSION
        )));
    }

    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::infra::{CURRENT_STORAGE_VERSION, RuntimeDataPaths};

    use super::{StorageManifest, StorageManifestRepository};

    #[test]
    fn bootstraps_manifest_when_runtime_storage_is_first_created() {
        let dir = tempdir().expect("temp dir");
        let layout = RuntimeDataPaths::new(dir.path().to_path_buf());
        let repository = StorageManifestRepository::new(layout.clone()).expect("repo");

        let manifest = repository.bootstrap().expect("bootstrap");

        assert_eq!(manifest.version, CURRENT_STORAGE_VERSION);
        assert!(layout.storage_manifest_path().exists());
    }

    #[test]
    fn migrates_legacy_manifest_versions_to_current() {
        let dir = tempdir().expect("temp dir");
        let layout = RuntimeDataPaths::new(dir.path().to_path_buf());
        let repository = StorageManifestRepository::new(layout.clone()).expect("repo");
        repository
            .save(&StorageManifest { version: 0 })
            .expect("seed legacy manifest");

        let manifest = repository.bootstrap().expect("bootstrap");

        assert_eq!(manifest.version, CURRENT_STORAGE_VERSION);
        assert_eq!(
            repository.load().expect("load manifest"),
            Some(StorageManifest {
                version: CURRENT_STORAGE_VERSION,
            })
        );
    }
}
