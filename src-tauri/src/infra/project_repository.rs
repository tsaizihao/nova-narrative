use std::{collections::HashMap, fs, time::UNIX_EPOCH};

use crate::{
    error::AppResult,
    models::NovelProject,
};

use super::RuntimeDataPaths;

#[derive(Debug, Clone)]
pub struct ProjectRepository {
    layout: RuntimeDataPaths,
}

impl ProjectRepository {
    pub fn new(layout: RuntimeDataPaths) -> AppResult<Self> {
        layout.ensure_layout()?;
        Ok(Self { layout })
    }

    pub fn save(&self, project: &NovelProject) -> AppResult<()> {
        let content = serde_json::to_string_pretty(project)?;
        fs::write(self.layout.project_path(&project.id), content)?;
        Ok(())
    }

    pub fn last_modified_millis(&self, project_id: &str) -> AppResult<Option<i64>> {
        let path = self.layout.project_path(project_id);
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
    pub fn load_all(&self) -> AppResult<HashMap<String, NovelProject>> {
        let mut projects = HashMap::new();
        for entry in fs::read_dir(self.layout.projects_dir())? {
            let entry = entry?;
            let raw = fs::read_to_string(entry.path())?;
            let project: NovelProject = serde_json::from_str(&raw)?;
            projects.insert(
                entry
                    .file_name()
                    .to_string_lossy()
                    .trim_end_matches(".json")
                    .to_string(),
                project,
            );
        }
        Ok(projects)
    }
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use crate::{infra::RuntimeDataPaths, models::NovelProject};

    use super::ProjectRepository;

    #[test]
    fn round_trips_projects_without_changing_json_location() {
        let dir = tempdir().expect("temp dir");
        let layout = RuntimeDataPaths::new(dir.path().to_path_buf());
        let repository = ProjectRepository::new(layout.clone()).expect("repo");
        let project = NovelProject {
            id: "project-1".into(),
            name: "北门夜话".into(),
            ..NovelProject::default()
        };

        repository.save(&project).expect("save");

        let reloaded = repository.load_all().expect("load");
        assert_eq!(reloaded["project-1"].name, "北门夜话");
        assert!(layout.project_path("project-1").exists());
    }
}
