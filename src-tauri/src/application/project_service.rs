use crate::{
    app_api::input_validation::{require_project_id, require_project_name, require_story_text},
    error::AppResult,
    models::{BuildStatus, NovelProject, SavedProjectLibraryEntry, StoryPackage},
    store::ProjectStore,
};

pub struct ProjectService;

impl ProjectService {
    pub fn create_project(store: &mut ProjectStore, name: &str) -> AppResult<NovelProject> {
        let name = require_project_name(name)?;
        store.create_project(name)
    }

    pub fn list_projects(store: &mut ProjectStore) -> AppResult<Vec<NovelProject>> {
        store.list_projects()
    }

    pub fn list_saved_projects(store: &mut ProjectStore) -> AppResult<Vec<SavedProjectLibraryEntry>> {
        store.list_saved_projects()
    }

    pub fn import_novel_text(
        store: &mut ProjectStore,
        project_id: &str,
        content: &str,
    ) -> AppResult<NovelProject> {
        let project_id = require_project_id(project_id)?;
        let content = require_story_text(content)?;
        store.import_novel_text(project_id, content)
    }

    pub fn build_story_package(store: &mut ProjectStore, project_id: &str) -> AppResult<BuildStatus> {
        let project_id = require_project_id(project_id)?;
        store.build_story_package(project_id)
    }

    pub fn get_build_status(store: &mut ProjectStore, project_id: &str) -> AppResult<BuildStatus> {
        let project_id = require_project_id(project_id)?;
        store.get_build_status(project_id)
    }

    pub fn load_story_package(store: &mut ProjectStore, project_id: &str) -> AppResult<StoryPackage> {
        let project_id = require_project_id(project_id)?;
        store.load_story_package(project_id)
    }

    pub fn get_project(store: &mut ProjectStore, project_id: &str) -> AppResult<NovelProject> {
        let project_id = require_project_id(project_id)?;
        store.get_project(project_id)
    }
}
