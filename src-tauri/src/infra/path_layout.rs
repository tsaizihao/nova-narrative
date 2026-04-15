use std::{fs, path::PathBuf};

use crate::error::AppResult;

#[derive(Debug, Clone)]
pub struct RuntimeDataPaths {
    base_dir: PathBuf,
}

impl RuntimeDataPaths {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn ensure_layout(&self) -> AppResult<()> {
        fs::create_dir_all(self.projects_dir())?;
        fs::create_dir_all(self.sessions_dir())?;
        Ok(())
    }

    pub fn projects_dir(&self) -> PathBuf {
        self.base_dir.join("projects")
    }

    pub fn sessions_dir(&self) -> PathBuf {
        self.base_dir.join("sessions")
    }

    pub fn ai_settings_path(&self) -> PathBuf {
        self.base_dir.join("ai-settings.json")
    }

    pub fn project_path(&self, id: &str) -> PathBuf {
        self.projects_dir().join(format!("{id}.json"))
    }

    pub fn session_path(&self, id: &str) -> PathBuf {
        self.sessions_dir().join(format!("{id}.json"))
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::RuntimeDataPaths;

    #[test]
    fn returns_project_session_and_settings_paths_using_existing_layout() {
        let layout = RuntimeDataPaths::new(PathBuf::from("/tmp/nova-runtime"));

        assert_eq!(layout.projects_dir(), PathBuf::from("/tmp/nova-runtime/projects"));
        assert_eq!(layout.sessions_dir(), PathBuf::from("/tmp/nova-runtime/sessions"));
        assert_eq!(
            layout.ai_settings_path(),
            PathBuf::from("/tmp/nova-runtime/ai-settings.json")
        );
        assert_eq!(
            layout.project_path("project-1"),
            PathBuf::from("/tmp/nova-runtime/projects/project-1.json")
        );
        assert_eq!(
            layout.session_path("session-1"),
            PathBuf::from("/tmp/nova-runtime/sessions/session-1.json")
        );
    }
}
