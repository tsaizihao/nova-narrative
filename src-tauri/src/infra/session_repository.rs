use std::{collections::HashMap, fs, time::UNIX_EPOCH};

use crate::{
    error::AppResult,
    models::SessionState,
};

use super::RuntimeDataPaths;

#[derive(Debug, Clone)]
pub struct SessionRepository {
    layout: RuntimeDataPaths,
}

impl SessionRepository {
    pub fn new(layout: RuntimeDataPaths) -> AppResult<Self> {
        layout.ensure_layout()?;
        Ok(Self { layout })
    }

    pub fn save(&self, session: &SessionState) -> AppResult<()> {
        let content = serde_json::to_string_pretty(session)?;
        fs::write(self.layout.session_path(&session.session_id), content)?;
        Ok(())
    }

    pub fn delete(&self, session_id: &str) -> AppResult<()> {
        let path = self.layout.session_path(session_id);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }

    pub fn last_modified_millis(&self, session_id: &str) -> AppResult<Option<i64>> {
        let path = self.layout.session_path(session_id);
        if !path.exists() {
            return Ok(None);
        }

        let modified = fs::metadata(path)?.modified()?;
        let millis = modified
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        Ok(Some(millis))
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub fn load_all(&self) -> AppResult<HashMap<String, SessionState>> {
        let mut sessions = HashMap::new();
        for entry in fs::read_dir(self.layout.sessions_dir())? {
            let entry = entry?;
            let raw = fs::read_to_string(entry.path())?;
            let session: SessionState = serde_json::from_str(&raw)?;
            sessions.insert(
                entry
                    .file_name()
                    .to_string_lossy()
                    .trim_end_matches(".json")
                    .to_string(),
                session,
            );
        }
        Ok(sessions)
    }
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::{infra::RuntimeDataPaths, models::SessionState};

    use super::SessionRepository;

    #[test]
    fn round_trips_sessions_without_changing_json_location() {
        let dir = tempdir().expect("temp dir");
        let layout = RuntimeDataPaths::new(dir.path().to_path_buf());
        let repository = SessionRepository::new(layout.clone()).expect("repo");
        let session = SessionState {
            session_id: "session-1".into(),
            project_id: "project-1".into(),
            current_scene_id: "scene-1".into(),
            ..SessionState::default()
        };

        repository.save(&session).expect("save");

        let reloaded = repository.load_all().expect("load");
        assert_eq!(reloaded["session-1"].project_id, "project-1");
        assert!(layout.session_path("session-1").exists());
    }
}
